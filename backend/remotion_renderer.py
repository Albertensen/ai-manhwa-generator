import os
import sys
import json
import time
import subprocess
import urllib.request
from pathlib import Path

# Setup base paths
BASE_DIR = Path(__file__).resolve().parent.parent
try:
    from . import config
    from .layer_separator import process_panel_layers
    from .storage_uploader import upload_file
except (ImportError, ValueError):
    import config
    try:
        from layer_separator import process_panel_layers
    except ImportError:
        process_panel_layers = None
    try:
        from storage_uploader import upload_file
    except ImportError:
        upload_file = None

def format_file_url(path_str: str, upload_to_storage: bool = True) -> str:
    """Converts local file path to base64 Data URI or Supabase URL (safe for Chrome sandbox)"""
    if not path_str:
        return ""
    if path_str.startswith("http://") or path_str.startswith("https://") or path_str.startswith("data:"):
        return path_str
    
    if path_str.startswith("file:///"):
        path_str = path_str[8:]

    p = Path(path_str).resolve()
    if not p.exists():
        return path_str

    if upload_to_storage and upload_file:
        try:
            folder = "cutouts" if "_cutout" in p.name else "panels"
            remote_path = f"{folder}/{p.name}"
            uploaded = upload_file(str(p), remote_path)
            if uploaded:
                return uploaded
        except Exception as e:
            print(f"[RemotionRenderer] Supabase upload failed, falling back to data URI: {e}")

    # Fallback to Data URI
    import mimetypes, base64
    mime, _ = mimetypes.guess_type(str(p))
    if not mime:
        mime = "image/png" if p.suffix.lower() == ".png" else "audio/mpeg"
    try:
        b64 = base64.b64encode(p.read_bytes()).decode("utf-8")
        return f"data:{mime};base64,{b64}"
    except Exception as e:
        print(f"[RemotionRenderer] Base64 encode failed for {p}: {e}")
        return str(p)

def build_props_json(
    scenes_data,
    project_title="AI Manhwa Recap",
    bgm_url=None,
    bgm_volume=0.28,
    fps=30,
    auto_generate_cutouts=True
):
    """
    Constructs compliant Remotion props dictionary matching ManhwaRecapProps.
    Automatically detects or generates character foreground cutouts with rembg.
    """
    formatted_scenes = []
    for idx, s in enumerate(scenes_data):
        raw_bg = s.get("backgroundUrl") or s.get("image_url") or ""
        raw_fg = s.get("foregroundUrl") or s.get("character_cutout_url") or ""
        raw_audio = s.get("audioUrl") or s.get("audio_url") or ""

        # Auto layer separation if foreground cutout is missing
        if not raw_fg and raw_bg and auto_generate_cutouts and process_panel_layers:
            try:
                print(f"[RemotionRenderer] Auto-generating cutout for scene {idx+1}...")
                layers = process_panel_layers(raw_bg)
                if layers.get("foreground_local") and os.path.exists(layers["foreground_local"]):
                    raw_fg = layers["foreground_local"]
            except Exception as e:
                print(f"[RemotionRenderer] Layer cutout skipped for scene {idx+1}: {e}")

        bg_url = format_file_url(raw_bg)
        fg_url = format_file_url(raw_fg) if raw_fg else None
        audio_url = format_file_url(raw_audio) if raw_audio else None

        # Format word timestamps if provided
        raw_words = s.get("wordTimestamps") or s.get("words") or []
        formatted_words = []
        for w in raw_words:
            formatted_words.append({
                "text": w.get("text") or w.get("word", ""),
                "start": float(w.get("start", 0)),
                "end": float(w.get("end", 0)),
                "duration": float(w.get("duration", 0))
            })

        formatted_scenes.append({
            "id": str(s.get("id") or f"scene-{idx+1}"),
            "sceneOrder": int(s.get("sceneOrder") or s.get("scene_order") or idx + 1),
            "backgroundUrl": bg_url,
            "foregroundUrl": fg_url,
            "narrationText": s.get("narrationText") or s.get("narration_text") or "",
            "audioUrl": audio_url,
            "sfxType": s.get("sfxType") or s.get("sfx_type") or "whoosh",
            "cameraMotion": s.get("cameraMotion") or s.get("camera_motion") or "zoom_in",
            "durationInSeconds": float(s.get("durationInSeconds") or s.get("duration_seconds") or 4.0),
            "wordTimestamps": formatted_words
        })

    return {
        "projectTitle": project_title,
        "bgmUrl": format_file_url(bgm_url) if bgm_url else "https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/bgm/epic_battle.mp3",
        "bgmVolume": float(bgm_volume),
        "fps": int(fps),
        "scenes": formatted_scenes
    }

def render_remotion_video(props_data: dict, output_file: str = None, timeout: int = 600) -> str:
    """
    Renders video using npx remotion render CLI with props.json
    """
    if not output_file:
        timestamp = int(time.time())
        output_file = str(config.OUTPUTS_DIR / f"remotion_{timestamp}.mp4")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write props to temporary JSON file
    props_tmp_path = BASE_DIR / "storage" / f"remotion_props_{int(time.time()*1000)}.json"
    props_tmp_path.parent.mkdir(parents=True, exist_ok=True)
    with open(props_tmp_path, "w", encoding="utf-8") as f:
        json.dump(props_data, f, indent=2, ensure_ascii=False)

    print(f"[RemotionRenderer] Props written to: {props_tmp_path}")
    print(f"[RemotionRenderer] Rendering target: {output_file}")

    # Build command
    cmd = [
        "npx",
        "remotion",
        "render",
        "src/remotion/index.ts",
        "ManhwaRecapComposition",
        output_file,
        f"--props={str(props_tmp_path)}",
        "--chromium-options=--allow-file-access-from-files --disable-web-security"
    ]

    print(f"[RemotionRenderer] Executing: {' '.join(cmd)}")
    start_t = time.time()
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(BASE_DIR),
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout
        )

        elapsed = time.time() - start_t
        print(f"[RemotionRenderer] Finished in {elapsed:.2f}s (Exit code: {proc.returncode})")
        
        if proc.returncode != 0:
            print("[RemotionRenderer] ERROR STDERR:")
            print(proc.stderr)
            print("[RemotionRenderer] STDOUT:")
            print(proc.stdout)
            raise RuntimeError(f"Remotion render failed with exit code {proc.returncode}")

        print("[RemotionRenderer] Success!")

        # Cleanup temp props
        try:
            if props_tmp_path.exists():
                props_tmp_path.unlink()
        except Exception:
            pass

        return output_file

    except subprocess.TimeoutExpired:
        raise TimeoutError(f"Remotion render timed out after {timeout} seconds")

def render_supabase_project(project_id: str, output_path: str = None, bgm_preset: str = None) -> str:
    """
    Loads project & scenes directly from Supabase, formats props, renders via Remotion,
    and uploads final video to Supabase Storage.
    """
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}"
    }

    # 1. Fetch project
    proj_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_projects?id=eq.{project_id}&select=*"
    req = urllib.request.Request(proj_url, headers=headers)
    with urllib.request.urlopen(req) as res:
        proj_list = json.loads(res.read())
        if not proj_list:
            raise ValueError(f"Project not found: {project_id}")
        project = proj_list[0]

    # 2. Fetch scenes
    scenes_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_scenes?project_id=eq.{project_id}&order=scene_order.asc"
    req_scenes = urllib.request.Request(scenes_url, headers=headers)
    with urllib.request.urlopen(req_scenes) as res:
        scenes = json.loads(res.read())

    print(f"[RemotionRenderer] Fetched {len(scenes)} scenes for project '{project.get('title')}'")

    # 3. Determine BGM
    preset_name = bgm_preset or "epic_battle"
    bgm_url = f"{config.SUPABASE_URL}/storage/v1/object/public/manhwa-assets/bgm/{preset_name}.mp3"

    # 4. Build props
    props = build_props_json(
        scenes,
        project_title=project.get("title") or "Manhwa Recap",
        bgm_url=bgm_url,
        auto_generate_cutouts=True
    )

    # 5. Render
    if not output_path:
        output_path = str(config.OUTPUTS_DIR / f"{project_id}_remotion.mp4")

    rendered_file = render_remotion_video(props, output_path)

    # 6. Upload to Supabase
    if upload_file and os.path.exists(rendered_file):
        remote_dest = f"videos/{project_id}.mp4"
        public_url = upload_file(rendered_file, remote_dest)
        print(f"[RemotionRenderer] Uploaded final video to Supabase: {public_url}")

        # Update project record
        update_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_projects?id=eq.{project_id}"
        update_payload = json.dumps({
            "video_url": public_url,
            "status": "completed"
        }).encode("utf-8")
        update_req = urllib.request.Request(
            update_url,
            data=update_payload,
            headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
            method="PATCH"
        )
        with urllib.request.urlopen(update_req):
            print("[RemotionRenderer] Supabase project status updated to completed.")

        # Update video job record if exists
        try:
            job_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_video_jobs?project_id=eq.{project_id}"
            job_payload = json.dumps({
                "video_url": public_url,
                "status": "completed",
                "progress_percent": 100
            }).encode("utf-8")
            job_req = urllib.request.Request(
                job_url,
                data=job_payload,
                headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
                method="PATCH"
            )
            with urllib.request.urlopen(job_req):
                print("[RemotionRenderer] Supabase video job updated to completed.")
        except Exception as e:
            print(f"[RemotionRenderer] Non-fatal video job update notice: {e}")

        return public_url

    return rendered_file

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Remotion Headless Video Renderer")
    parser.add_argument("--props", type=str, help="Path to props.json")
    parser.add_argument("--project-id", type=str, help="Supabase project ID to render")
    parser.add_argument("--output", type=str, help="Output MP4 file path")
    parser.add_argument("--bgm-preset", type=str, default=None, help="BGM preset name (e.g. epic_battle)")
    args = parser.parse_args()

    if args.project_id:
        out = render_supabase_project(args.project_id, args.output, bgm_preset=args.bgm_preset)
        print(f"Rendered Supabase project: {out}")
    elif args.props and os.path.exists(args.props):
        with open(args.props, "r", encoding="utf-8") as f:
            props = json.load(f)
        out = render_remotion_video(props, args.output)
        print(f"Rendered: {out}")
    else:
        print("[RemotionRenderer] Running auto-cutout + Remotion smoke test...")
        sample_props = build_props_json(
            [
                {
                    "id": "scene-smoke-auto",
                    "scene_order": 1,
                    "image_url": "https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/panels/kaelen_scene1_upgraded.png",
                    "narration_text": "Kaelen berdiri kokoh menyambut aura kegelapan yang bangkit.",
                    "camera_motion": "zoom_in",
                    "duration_seconds": 3.0,
                    "sfx_type": "whoosh",
                    "words": [
                        {"text": "Kaelen", "start": 0.1, "end": 0.6},
                        {"text": "berdiri", "start": 0.65, "end": 1.1},
                        {"text": "kokoh", "start": 1.15, "end": 1.6},
                        {"text": "menyambut", "start": 1.65, "end": 2.2},
                        {"text": "aura", "start": 2.25, "end": 2.6},
                        {"text": "kegelapan.", "start": 2.65, "end": 3.0}
                    ]
                }
            ],
            project_title="Auto Cutout Smoke Test",
            auto_generate_cutouts=True
        )
        out = render_remotion_video(sample_props, str(config.OUTPUTS_DIR / "smoke_test_autocutout.mp4"))
        print(f"[RemotionRenderer] Test render complete: {out}")
