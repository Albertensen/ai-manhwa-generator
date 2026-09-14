import urllib.parse
import os
import io
import time
import base64
import json
import urllib.request
import urllib.error
from pathlib import Path
from PIL import Image

try:
    from . import config
except (ImportError, ValueError):
    import config

DEFAULT_IMAGE_MODEL = "ag/gemini-3.1-flash-image"
FALLBACK_IMAGE_MODEL = "flux"

HIGH_END_STYLE_PREFIX = (
    "high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, "
    "dramatic rim lighting, unreal engine 5 render, highly detailed, 8k wallpaper"
)
STRICT_NEGATIVE_PROMPT = (
    "ugly, low quality, deformed anatomy, blurry, artifacts, lowres, distorted face, "
    "mutated hands, extra fingers, bad eyes, text, speech bubble, watermark, signature"
)


def _prepare_reference_b64(ref_path: str, max_size=(512, 768)) -> str:
    """Prepares an optimized base64 image data URI for conditioning."""
    if not os.path.exists(ref_path):
        return ""
    try:
        im = Image.open(ref_path)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im.thumbnail(max_size, Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=85)
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        print(f"[CloudImage] Warning: Failed to encode reference image {ref_path}: {e}")
        return ""


def generate_panel_cloud(
    prompt_text: str,
    negative_text: str = "",
    output_path: str = None,
    ref_image_path: str = None,
    model: str = DEFAULT_IMAGE_MODEL,
    timeout: int = 90
) -> str:
    """
    Generates a high-quality vertical (9:16) manhwa panel using cloud generation.
    Supports 2-step character consistency via ref_image_path.
    """
    if not output_path:
        output_path = str(config.PANELS_DIR / f"panel_{int(time.time()*1000)}.png")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # 1. Compose enhanced manhwa prompt
    clean_prompt = prompt_text.strip()
    if not clean_prompt.lower().startswith("high-end cinematic manhwa"):
        full_prompt = f"{HIGH_END_STYLE_PREFIX}, {clean_prompt}"
    else:
        full_prompt = clean_prompt

    if ref_image_path and os.path.exists(ref_image_path):
        full_prompt = f"{full_prompt}, maintaining exact same face, hair style, and features as reference character"

    payload = {
        "model": model,
        "prompt": full_prompt,
        "size": "1024x1792"  # Translates to vertical 9:16
    }

    # 2. Attach reference image conditioning if provided
    if ref_image_path:
        b64_uri = _prepare_reference_b64(ref_image_path)
        if b64_uri:
            payload["image"] = b64_uri
            print(f"[CloudImage] Attached character reference image: {ref_image_path}")

    # 3. Call 9Router Image Generation API
    req = urllib.request.Request(
        f"{config.ROUTER_URL}/images/generations",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {config.ROUTER_KEY}",
            "Content-Type": "application/json"
        }
    )

    t0 = time.time()
    print(f"[CloudImage] Requesting render via {model} (prompt: {full_prompt[:60]}...)...")

    success = False
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            data = json.loads(res.read())
            b64_img = data["data"][0]["b64_json"]
            img_bytes = base64.b64decode(b64_img)

            # Ensure image is valid and save
            im = Image.open(io.BytesIO(img_bytes))
            im.save(output_path, "PNG")
            success = True
            print(f"[CloudImage] Render completed in {time.time() - t0:.2f}s -> {output_path} (Size: {im.size})")
    except Exception as e:
        print(f"[CloudImage] 9Router cloud generation failed: {e}")

    # Fallback to Pollinations FLUX cloud if 9Router fails
    if not success:
        print("[CloudImage] Invoking fallback Cloud FLUX generator...")
        try:
            encoded = urllib.parse.quote(full_prompt)
            flux_url = f"https://image.pollinations.ai/prompt/{encoded}?width=832&height=1216&model=flux&nologo=true"
            f_req = urllib.request.Request(flux_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(f_req, timeout=45) as f_res:
                flux_data = f_res.read()
                im_flux = Image.open(io.BytesIO(flux_data))
                im_flux.save(output_path, "PNG")
                success = True
                print(f"[CloudImage] Fallback FLUX completed -> {output_path} (Size: {im_flux.size})")
        except Exception as fe:
            print(f"[CloudImage] Fallback FLUX also failed: {fe}")
            raise RuntimeError(f"All image generators failed: {e} | {fe}")

    return output_path


def generate_master_character_sheet(
    character_name: str,
    appearance_desc: str,
    output_path: str = None
) -> str:
    """
    Step 1 of 2-Step Character Consistency:
    Generates a high-resolution Anchor Master Character Sheet (portrait & upper body).
    """
    if not output_path:
        safe_name = character_name.lower().replace(" ", "_")
        output_path = str(config.PANELS_DIR / f"char_master_{safe_name}.png")

    anchor_prompt = (
        f"{HIGH_END_STYLE_PREFIX}, character sheet, master reference portrait, "
        f"character close-up face and upper body, {character_name}: {appearance_desc}, "
        "neutral confident expression, highly detailed facial features, clean dark aesthetic background, sharp focus, 8k"
    )

    return generate_panel_cloud(
        prompt_text=anchor_prompt,
        output_path=output_path,
        ref_image_path=None
    )
