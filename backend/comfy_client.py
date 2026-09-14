import json
import urllib.request
import urllib.parse
import uuid
import os
import shutil
import time
import subprocess
import websocket

try:
    from . import config
except (ImportError, ValueError):
    import config

COMFY_INPUT_DIR = os.path.join(os.path.dirname(config.COMFYUI_HOST), "input") if os.path.isabs(config.COMFYUI_HOST) else r"C:\ComfyUI\input"

def ensure_comfyui_running():
    """Checks if ComfyUI is responding; if not, restarts it via scheduled task"""
    try:
        with urllib.request.urlopen(f"{config.COMFYUI_HOST}/system_stats", timeout=3) as res:
            return True
    except Exception:
        print("ComfyUI server offline, auto-restarting via ComfyUIServer task...")
        subprocess.run('schtasks /run /tn "ComfyUIServer"', shell=True, capture_output=True)
        for attempt in range(15):
            time.sleep(1)
            try:
                with urllib.request.urlopen(f"{config.COMFYUI_HOST}/system_stats", timeout=2) as res:
                    print("ComfyUI successfully restarted and online!")
                    return True
            except Exception:
                continue
    return False

def ensure_ref_image(ref_image_path):
    """Ensures reference image exists inside ComfyUI input folder and returns its basename"""
    if not ref_image_path or not os.path.exists(ref_image_path):
        return None
    os.makedirs(COMFY_INPUT_DIR, exist_ok=True)
    basename = os.path.basename(ref_image_path)
    dest_path = os.path.join(COMFY_INPUT_DIR, basename)
    if os.path.abspath(ref_image_path) != os.path.abspath(dest_path):
        shutil.copyfile(ref_image_path, dest_path)
    return basename

def build_sdxl_workflow(prompt_text, negative_text, ref_image_basename=None, ipadapter_weight=0.7, output_prefix="manhwa_panel"):
    """Generates a headless ComfyUI SDXL prompt graph, optionally with IP-Adapter character conditioning"""
    model_source = ["4", 0]
    extra_nodes = {}

    if ref_image_basename:
        extra_nodes = {
            "10": {
                "inputs": {
                    "ipadapter_file": "ip-adapter-plus_sdxl_vit-h.safetensors"
                },
                "class_type": "IPAdapterModelLoader"
            },
            "11": {
                "inputs": {
                    "clip_name": "CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors"
                },
                "class_type": "CLIPVisionLoader"
            },
            "12": {
                "inputs": {
                    "image": ref_image_basename
                },
                "class_type": "LoadImage"
            },
            "13": {
                "inputs": {
                    "weight": float(ipadapter_weight),
                    "weight_type": "linear",
                    "combine_embeds": "concat",
                    "start_at": 0.0,
                    "end_at": 1.0,
                    "embeds_scaling": "V only",
                    "model": ["4", 0],
                    "ipadapter": ["10", 0],
                    "image": ["12", 0],
                    "clip_vision": ["11", 0]
                },
                "class_type": "IPAdapterAdvanced"
            }
        }
        model_source = ["13", 0]

    workflow = {
        "3": {
            "inputs": {
                "seed": int(uuid.uuid4().int % 1000000000),
                "steps": 25,
                "cfg": 7.0,
                "sampler_name": "euler_ancestral",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": model_source,
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0]
            },
            "class_type": "KSampler"
        },
        "4": {
            "inputs": {
                "ckpt_name": config.CHECKPOINT_NAME
            },
            "class_type": "CheckpointLoaderSimple"
        },
        "5": {
            "inputs": {
                "width": 832,
                "height": 1216,
                "batch_size": 1
            },
            "class_type": "EmptyLatentImage"
        },
        "6": {
            "inputs": {
                "text": f"masterpiece, best quality, {prompt_text}",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "7": {
            "inputs": {
                "text": f"low quality, worst quality, deformed, bad hands, {negative_text}",
                "clip": ["4", 1]
            },
            "class_type": "CLIPTextEncode"
        },
        "8": {
            "inputs": {
                "samples": ["3", 0],
                "vae": ["4", 2]
            },
            "class_type": "VAEDecode"
        },
        "9": {
            "inputs": {
                "filename_prefix": output_prefix,
                "images": ["8", 0]
            },
            "class_type": "SaveImage"
        }
    }

    workflow.update(extra_nodes)
    return workflow

def queue_prompt(prompt_workflow, client_id):
    payload = json.dumps({"prompt": prompt_workflow, "client_id": client_id}).encode('utf-8')
    req = urllib.request.Request(f"{config.COMFYUI_HOST}/prompt", data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read())

def download_image(filename, subfolder, folder_type, dest_path):
    params = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": folder_type})
    url = f"{config.COMFYUI_HOST}/view?{params}"
    urllib.request.urlretrieve(url, dest_path)

def generate_panel(prompt_text, negative_text, output_path, ref_image_path=None, ipadapter_weight=0.7, engine=None):
    """
    Renders a panel image with 2-step character consistency.
    Defaults to high-quality cloud generation (ag/gemini-3.1-flash-image) with fallback to local ComfyUI SDXL.
    """
    if engine is None:
        engine = os.getenv("IMAGE_ENGINE", "cloud")

    if engine == "cloud":
        try:
            try:
                from . import cloud_image_client
            except (ImportError, ValueError):
                import cloud_image_client
            return cloud_image_client.generate_panel_cloud(
                prompt_text=prompt_text,
                negative_text=negative_text,
                output_path=output_path,
                ref_image_path=ref_image_path
            )
        except Exception as ce:
            print(f"[comfy_client] Cloud image generation error: {ce}, falling back to local ComfyUI...")

    # Fallback / explicit local ComfyUI SDXL workflow
    ensure_comfyui_running()
    
    client_id = str(uuid.uuid4())
    ref_basename = ensure_ref_image(ref_image_path) if ref_image_path else None
    
    workflow = build_sdxl_workflow(
        prompt_text=prompt_text,
        negative_text=negative_text,
        ref_image_basename=ref_basename,
        ipadapter_weight=ipadapter_weight
    )
    
    prompt_res = queue_prompt(workflow, client_id)
    prompt_id = prompt_res.get('prompt_id')
    print(f"Queued ComfyUI prompt {prompt_id} (IPAdapter: {bool(ref_basename)}), awaiting execution...")
    
    ws_url = f"{config.COMFYUI_WS}?clientId={client_id}"
    ws = websocket.create_connection(ws_url)
    
    output_filename = None
    output_subfolder = ""
    output_type = "output"
    
    while True:
        out = ws.recv()
        if isinstance(out, str):
            message = json.loads(out)
            msg_type = message.get('type')
            data = message.get('data', {})
            
            if msg_type == 'status':
                pass
            elif msg_type == 'executing':
                if data.get('node') is None and data.get('prompt_id') == prompt_id:
                    print("Execution finished!")
                    break
            elif msg_type == 'executed':
                if data.get('prompt_id') == prompt_id:
                    output_images = data.get('output', {}).get('images', [])
                    if output_images:
                        output_filename = output_images[0].get('filename')
                        output_subfolder = output_images[0].get('subfolder', '')
                        output_type = output_images[0].get('type', 'output')
            elif msg_type == 'execution_error':
                ws.close()
                raise RuntimeError(f"ComfyUI execution error: {data}")
        else:
            continue
            
    ws.close()
    
    if output_filename:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        download_image(output_filename, output_subfolder, output_type, output_path)
        print(f"Panel downloaded to {output_path}")
        return output_path
    else:
        raise RuntimeError("No image output generated by ComfyUI")
