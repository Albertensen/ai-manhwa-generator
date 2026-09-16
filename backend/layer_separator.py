import os
import sys
import urllib.request
from pathlib import Path
from PIL import Image

try:
    from . import config
    from .storage_uploader import upload_file
except (ImportError, ValueError):
    import config
    try:
        from storage_uploader import upload_file
    except ImportError:
        upload_file = None

_REMBG_SESSION = None

def get_rembg_session():
    """Initializes rembg session with fallback caching"""
    global _REMBG_SESSION
    if _REMBG_SESSION is None:
        try:
            import rembg
            # Use default u2net or isnet-general-use
            _REMBG_SESSION = rembg.new_session()
        except Exception as e:
            print(f"[LayerSeparator] Warning initializing rembg session: {e}")
            _REMBG_SESSION = False
    return _REMBG_SESSION

def process_panel_layers(
    image_input: str,
    output_dir: str = None,
    upload_to_storage: bool = False
) -> dict:
    """
    Takes an image file path or URL, removes background for character cutout,
    and returns paths/URLs for foreground cutout and background.
    
    Returns:
        {
            "foreground_local": path_to_cutout.png,
            "background_local": path_to_bg.png,
            "foreground_url": url_or_local_path,
            "background_url": url_or_local_path
        }
    """
    if not output_dir:
        output_dir = str(config.PANELS_DIR)
    os.makedirs(output_dir, exist_ok=True)

    # 1. Resolve local source image
    temp_download = None
    if image_input.startswith("http://") or image_input.startswith("https://"):
        base_name = Path(image_input.split("?")[0]).stem or "panel_scene"
        local_src = os.path.join(output_dir, f"{base_name}_src.png")
        if not os.path.exists(local_src):
            print(f"[LayerSeparator] Downloading remote panel: {image_input}")
            urllib.request.urlretrieve(image_input, local_src)
        temp_download = local_src
    else:
        local_src = os.path.abspath(image_input)
        base_name = Path(local_src).stem

    cutout_path = os.path.join(output_dir, f"{base_name}_cutout.png")
    bg_path = os.path.join(output_dir, f"{base_name}_bg.png")

    # 2. Check if cutout already generated
    if os.path.exists(cutout_path) and os.path.getsize(cutout_path) > 1000:
        print(f"[LayerSeparator] Reusing cached cutout: {cutout_path}")
    else:
        print(f"[LayerSeparator] Generating transparent cutout for: {base_name}...")
        try:
            import rembg
            session = get_rembg_session()
            with open(local_src, "rb") as inp_f:
                inp_bytes = inp_f.read()
            
            if session:
                out_bytes = rembg.remove(inp_bytes, session=session)
            else:
                out_bytes = rembg.remove(inp_bytes)

            with open(cutout_path, "wb") as out_f:
                out_f.write(out_bytes)
            print(f"[LayerSeparator] Saved cutout to: {cutout_path}")
        except Exception as e:
            print(f"[LayerSeparator] Error during cutout generation: {e}")
            cutout_path = None

    # 3. Create or symlink/copy background layer
    if not os.path.exists(bg_path):
        try:
            # We can use the full source panel as background
            with Image.open(local_src) as img:
                img.save(bg_path)
        except Exception as e:
            print(f"[LayerSeparator] Warning preparing background layer: {e}")
            bg_path = local_src

    fg_url = cutout_path
    bg_url = bg_path

    # 4. Optional Supabase upload
    if upload_to_storage and upload_file and cutout_path and os.path.exists(cutout_path):
        try:
            remote_cutout_name = f"panels/{Path(cutout_path).name}"
            remote_bg_name = f"panels/{Path(bg_path).name}"
            fg_url = upload_file(cutout_path, remote_cutout_name)
            bg_url = upload_file(bg_path, remote_bg_name)
            print(f"[LayerSeparator] Uploaded layers to Supabase: {fg_url}")
        except Exception as e:
            print(f"[LayerSeparator] Supabase upload skipped: {e}")

    return {
        "foreground_local": cutout_path,
        "background_local": bg_path,
        "foreground_url": fg_url,
        "background_url": bg_url
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Auto-Cutout Layer Separator for Manhwa 2.5D Parallax")
    parser.add_argument("image", help="Path or URL to panel image")
    parser.add_argument("--upload", action="store_true", help="Upload result to Supabase")
    args = parser.parse_args()

    res = process_panel_layers(args.image, upload_to_storage=args.upload)
    print("Result:", res)
