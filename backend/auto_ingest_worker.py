"""
AI Manhwa Recap Generator - Auto Ingest Worker
Monitors download directories for browser-generated I2V clips (Google Flow + Meta AI),
auto-sorts and renames clips, generates Edge-TTS voices & dynamic .ass karaoke subtitles,
burns subtitles, concatenates with SFX + 3-phase BGM, optimizes for web streaming (<48MB),
and uploads to Supabase Storage CDN.
"""

import os
import sys
import glob
import time
import json
import shutil
import asyncio
import argparse
import subprocess
import urllib.request
from datetime import datetime
from pathlib import Path

# Load config
try:
    from . import config
    from . import tts_engine
    from . import subtitle_generator
    from . import video_composer
    from . import storage_uploader
except (ImportError, ValueError):
    import config
    import tts_engine
    import subtitle_generator
    import video_composer
    import storage_uploader

STORAGE_DIR = Path(config.STORAGE_DIR)
RAW_DOWNLOADS_DIR = STORAGE_DIR / "raw_downloads"
PROJECT_CLIPS_DIR = STORAGE_DIR / "project_clips"
WIN_DOWNLOADS_DIR = Path.home() / "Downloads"

for d in [RAW_DOWNLOADS_DIR, PROJECT_CLIPS_DIR, config.OUTPUTS_DIR, config.AUDIOS_DIR, config.SUBTITLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)


def supabase_get(endpoint: str):
    """Performs authenticated GET against Supabase REST API."""
    url = f"{config.SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"[Supabase GET Error] {endpoint}: {e}")
        return None


def supabase_patch(endpoint: str, data: dict):
    """Performs authenticated PATCH against Supabase REST API."""
    url = f"{config.SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"[Supabase PATCH Error] {endpoint}: {e}")
        return None


def find_latest_active_project(project_id_arg: str = None, project_file_arg: str = None):
    """
    Finds active project metadata from:
    1. Specified project_file (.json)
    2. Any manhwa_project_*.json in Downloads or raw_downloads
    3. Specified project_id in Supabase
    4. Latest in-progress project in Supabase
    """
    # 1. Project file provided
    if project_file_arg and os.path.exists(project_file_arg):
        with open(project_file_arg, "r", encoding="utf-8") as f:
            return json.load(f)

    # 2. Look for project json package in raw_downloads or Windows Downloads
    for search_dir in [RAW_DOWNLOADS_DIR, WIN_DOWNLOADS_DIR]:
        if search_dir.exists():
            pkg_files = sorted(
                glob.glob(str(search_dir / "manhwa_project_*.json")),
                key=os.path.getmtime,
                reverse=True
            )
            if pkg_files:
                target_json = pkg_files[0]
                print(f"[INGEST] Discovered Project Package JSON: {target_json}")
                with open(target_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Cache in project directory
                    p_id = data.get("project_id", "local_project")
                    p_dir = PROJECT_CLIPS_DIR / p_id
                    p_dir.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(target_json, p_dir / "project.json")
                    return data

    # 3. Check cached project.json in PROJECT_CLIPS_DIR subdirectories
    for p_dir in PROJECT_CLIPS_DIR.iterdir():
        if p_dir.is_dir():
            cached_json = p_dir / "project.json"
            if cached_json.exists():
                with open(cached_json, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if project_id_arg is None or data.get("project_id") == project_id_arg:
                        return data

    # 4. Fetch from Supabase
    if project_id_arg:
        projects = supabase_get(f"manhwa_projects?id=eq.{project_id_arg}&limit=1")
    else:
        # Fetch latest project not yet completed
        projects = supabase_get("manhwa_projects?status=neq.completed&order=created_at.desc&limit=1")
        if not projects:
            # Or latest project
            projects = supabase_get("manhwa_projects?order=created_at.desc&limit=1")

    if projects and len(projects) > 0:
        proj = projects[0]
        p_id = proj["id"]
        # Fetch scenes
        scenes = supabase_get(f"manhwa_scenes?project_id=eq.{p_id}&order=scene_order.asc") or []
        proj["scenes"] = scenes
        proj["project_id"] = p_id

        # Cache to local project folder
        p_dir = PROJECT_CLIPS_DIR / p_id
        p_dir.mkdir(parents=True, exist_ok=True)
        with open(p_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(proj, f, indent=2)

        return proj

    return None


def scan_and_sort_clips(project_id: str, total_scenes: int):
    """
    Scans raw_downloads and Windows Downloads for incoming video clips.
    Sorts by index or chronological download time and maps to:
    storage/project_clips/{project_id}/scene_{idx:03d}.mp4
    """
    p_dir = PROJECT_CLIPS_DIR / project_id
    p_dir.mkdir(parents=True, exist_ok=True)

    # Check already ingested scenes
    existing_scenes = {}
    for i in range(1, total_scenes + 1):
        target = p_dir / f"scene_{i:03d}.mp4"
        if target.exists() and target.stat().st_size > 1024:
            existing_scenes[i] = target

    if len(existing_scenes) >= total_scenes:
        return existing_scenes

    # Search for candidate clips in raw_downloads and Downloads
    video_exts = [".mp4", ".webm", ".mov", ".mkv"]
    candidates = []

    for s_dir in [RAW_DOWNLOADS_DIR, WIN_DOWNLOADS_DIR]:
        if not s_dir.exists():
            continue
        for ext in video_exts:
            for f_path in s_dir.glob(f"*{ext}"):
                # Ignore partial / temporary files
                if f_path.name.endswith(".crdownload") or f_path.name.startswith("~"):
                    continue
                # Ignore files already in project dir
                if str(p_dir) in str(f_path):
                    continue
                # Ignore zero-byte or currently writing files
                try:
                    s1 = f_path.stat().st_size
                    if s1 < 5000:
                        continue
                    mtime = f_path.stat().st_mtime
                    candidates.append((f_path, mtime, s1))
                except Exception:
                    continue

    # Filter out candidates: sort primarily by indexed name if present, else by mtime
    def sort_key(item):
        path, mtime, _ = item
        name = path.stem.lower()
        # Look for numbers in filename like "scene_1", "scene 1", "(1)", "meta_ai_1"
        import re
        nums = re.findall(r"\d+", name)
        if nums:
            # If explicit scene/clip number
            return (0, int(nums[-1]), mtime)
        return (1, 0, mtime)

    candidates.sort(key=sort_key)

    # Assign candidates to missing scene slots
    assigned = dict(existing_scenes)
    candidate_idx = 0

    for i in range(1, total_scenes + 1):
        if i in assigned:
            continue
        if candidate_idx < len(candidates):
            src_file, _, _ = candidates[candidate_idx]
            dst_file = p_dir / f"scene_{i:03d}.mp4"
            print(f"[INGEST] Copying '{src_file.name}' -> {dst_file.name}")
            shutil.copy2(src_file, dst_file)
            assigned[i] = dst_file
            candidate_idx += 1

    return assigned


def optimize_web_mp4(input_path: str, output_path: str) -> str:
    """Ensures faststart and compresses to <48MB if needed for Supabase CDN streaming."""
    size_mb = os.path.getsize(input_path) / (1024 * 1024)
    print(f"[OPTIMIZE] Source size: {size_mb:.2f} MB")
    
    if size_mb > 48.0:
        print("[OPTIMIZE] Compressing with libx264 CRF 25 + faststart...")
        cmd = [
            config.FFMPEG_BIN, "-y",
            "-i", str(input_path),
            "-c:v", "libx264",
            "-crf", "25",
            "-preset", "veryfast",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            str(output_path)
        ]
    else:
        print("[OPTIMIZE] Stream copying with faststart metadata...")
        cmd = [
            config.FFMPEG_BIN, "-y",
            "-i", str(input_path),
            "-c", "copy",
            "-movflags", "+faststart",
            str(output_path)
        ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[OPTIMIZE] FFmpeg warning: {res.stderr[:300]}")
        return input_path
    
    final_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[OPTIMIZE] Final web size: {final_size:.2f} MB")
    return output_path


async def finalize_project(project: dict):
    """
    Executes Auto-Stitch & Finalize:
    1. Edge-TTS narration + word-level timestamps per scene.
    2. Dynamic .ass karaoke subtitles per scene.
    3. Burns subtitles and audio into each scene video.
    4. FFmpeg stream concat + SFX transitions + 3-phase dynamic BGM.
    5. Web streaming optimization (<48MB faststart).
    6. Uploads to Supabase Storage CDN and marks project 'completed'.
    """
    project_id = project.get("project_id") or project.get("id")
    title = project.get("title", "Untitled Recap")
    scenes = project.get("scenes", [])
    total_scenes = len(scenes)
    bgm_preset = project.get("bgm_preset", "epic_battle")

    print(f"\n=======================================================")
    print(f"[FINALIZING] Project: {title} ({project_id})")
    print(f"[FINALIZING] Total Scenes: {total_scenes} | BGM Preset: {bgm_preset}")
    print(f"=======================================================\n")

    p_dir = PROJECT_CLIPS_DIR / project_id
    final_scene_paths = []

    for idx, scene in enumerate(scenes, start=1):
        narration = scene.get("narration_text") or scene.get("dialogue_text") or f"Adegan {idx}"
        emotion = scene.get("voice_emotion", "dramatic")
        camera_motion = scene.get("camera_motion", "zoom_in")
        
        raw_clip = p_dir / f"scene_{idx:03d}.mp4"
        audio_path = config.AUDIOS_DIR / f"{project_id}_scene_{idx:03d}.mp3"
        sub_path = config.SUBTITLES_DIR / f"{project_id}_scene_{idx:03d}.ass"
        final_scene = p_dir / f"final_scene_{idx:03d}.mp4"

        print(f"[STAGE 1/3] Scene {idx}/{total_scenes}: Generating TTS Voice & Kara Subtitles...")
        # 1. Generate Voice with Word-level Timestamps
        dur = 4.0
        try:
            dur, word_events = await tts_engine.synthesize_voice(
                text=narration,
                output_file=str(audio_path),
                voice=config.DEFAULT_VOICE_MALE,
                return_timestamps=True
            )
            dur = max(dur, 3.0)
        except Exception as e:
            print(f"[TTS Error] Scene {idx}: {e}")
            word_events = []

        # 2. Generate Karaoke Subtitles (.ass)
        subtitle_generator.generate_ass_subtitle(
            word_events=word_events,
            output_path=str(sub_path),
            margin_v=480
        )

        # 3. Burn Subtitle into Video Clip
        print(f"[STAGE 1/3] Scene {idx}/{total_scenes}: Burning subtitles into motion clip (dur={dur:.2f}s)...")
        video_composer.create_scene_video(
            image_path="",
            audio_path=str(audio_path),
            duration=dur,
            output_path=str(final_scene),
            motion=camera_motion,
            subtitle_path=str(sub_path),
            input_video_path=str(raw_clip)
        )
        final_scene_paths.append(str(final_scene))

    # Phase 2: Concatenate all scenes with SFX & Dynamic BGM
    print(f"\n[STAGE 2/3] Concat {len(final_scene_paths)} scenes with SFX transitions and cinematic BGM...")
    raw_master_mp4 = str(config.OUTPUTS_DIR / f"{project_id}_master.mp4")
    video_composer.concat_scenes(
        scene_video_paths=final_scene_paths,
        final_output_path=raw_master_mp4,
        bgm_preset=bgm_preset,
        bgm_volume=0.18
    )

    # Phase 3: Web optimization
    web_master_mp4 = str(config.OUTPUTS_DIR / f"{project_id}_web.mp4")
    optimized_path = optimize_web_mp4(raw_master_mp4, web_master_mp4)

    # Phase 4: Upload to Supabase CDN
    print(f"\n[STAGE 3/3] Uploading final recap to Supabase Storage CDN...")
    remote_name = f"videos/{project_id}_final.mp4"
    cdn_url = storage_uploader.upload_file(optimized_path, remote_name)
    print(f"[SUCCESS] Uploaded to Supabase CDN: {cdn_url}")

    # Phase 5: Update Database Status to Completed
    print(f"[DB] Updating project status to 'completed' in Supabase...")
    now_iso = datetime.now().isoformat()
    supabase_patch(f"manhwa_projects?id=eq.{project_id}", {
        "status": "completed",
        "updated_at": now_iso
    })

    # Update or insert into manhwa_video_jobs
    existing_jobs = supabase_get(f"manhwa_video_jobs?project_id=eq.{project_id}")
    if existing_jobs and len(existing_jobs) > 0:
        supabase_patch(f"manhwa_video_jobs?project_id=eq.{project_id}", {
            "status": "completed",
            "progress_percent": 100,
            "video_url": cdn_url,
            "updated_at": now_iso
        })
    else:
        # Create new job record
        from urllib.request import Request, urlopen
        post_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_video_jobs"
        post_headers = {
            "apikey": config.SUPABASE_KEY,
            "Authorization": f"Bearer {config.SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
        post_data = json.dumps({
            "project_id": project_id,
            "status": "completed",
            "progress_percent": 100,
            "video_url": cdn_url
        }).encode("utf-8")
        try:
            req = Request(post_url, data=post_data, headers=post_headers, method="POST")
            with urlopen(req) as res:
                print("[DB] Created video job record in Supabase.")
        except Exception as e:
            print(f"[DB Job Insert Error]: {e}")

    supabase_patch(f"manhwa_scenes?project_id=eq.{project_id}", {
        "status": "ready"
    })

    print(f"\n=======================================================")
    print(f"[COMPLETE] Recap Production Finished Successfully!")
    print(f"[VIDEO URL] {cdn_url}")
    print(f"=======================================================\n")
    return cdn_url


def run_watcher(poll_interval: int = 4, project_id: str = None, project_file: str = None):
    """Continuous folder monitoring watcher loop."""
    print(f"\n[WATCHER] Auto-Ingest Watcher is ACTIVE.")
    print(f"[WATCHER] Monitoring:\n - {RAW_DOWNLOADS_DIR}\n - {WIN_DOWNLOADS_DIR}")
    print(f"[WATCHER] Polling interval: {poll_interval}s. Press Ctrl+C to stop.\n")

    while True:
        try:
            project = find_latest_active_project(project_id, project_file)
            if not project:
                print("[WATCHER] No active project found in database or downloads. Waiting...")
                time.sleep(poll_interval)
                continue

            p_id = project.get("project_id") or project.get("id")
            title = project.get("title", "Manhwa Project")
            total_scenes = len(project.get("scenes", []))

            if total_scenes == 0:
                print(f"[WATCHER] Project '{title}' has 0 scenes. Waiting for storyboard generation...")
                time.sleep(poll_interval)
                continue

            # Scan and sort downloaded clips
            assigned = scan_and_sort_clips(p_id, total_scenes)
            ingested_count = len(assigned)

            print(f"[WATCHER] [{datetime.now().strftime('%H:%M:%S')}] Project: '{title}' ({p_id[:8]}) | Clips: {ingested_count}/{total_scenes}")

            if ingested_count >= total_scenes:
                print(f"[WATCHER] All {total_scenes} clips ingested! Triggering Finalize Pipeline...")
                asyncio.run(finalize_project(project))
                print(f"[WATCHER] Finalize finished. Resuming watcher...")

        except KeyboardInterrupt:
            print("\n[WATCHER] Stopped by user.")
            break
        except Exception as e:
            print(f"[WATCHER ERROR] {e}")

        time.sleep(poll_interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AI Manhwa Auto Ingest Worker")
    parser.add_argument("--watch", action="store_true", help="Run in continuous watcher mode")
    parser.add_argument("--project-id", type=str, default=None, help="Specific project ID to process")
    parser.add_argument("--project-file", type=str, default=None, help="Path to downloaded project .json package")
    parser.add_argument("--poll-interval", type=int, default=4, help="Seconds between folder scans")
    args = parser.parse_args()

    if args.watch:
        run_watcher(args.poll_interval, args.project_id, args.project_file)
    else:
        # Run one check
        proj = find_latest_active_project(args.project_id, args.project_file)
        if not proj:
            print("[ERROR] No active project found.")
            sys.exit(1)
        p_id = proj.get("project_id") or proj.get("id")
        total = len(proj.get("scenes", []))
        print(f"[INFO] Active Project: '{proj.get('title')}' ({p_id}) with {total} scenes.")
        assigned = scan_and_sort_clips(p_id, total)
        print(f"[INFO] Ingested clips: {len(assigned)}/{total}")
        if len(assigned) >= total:
            asyncio.run(finalize_project(proj))
        else:
            print(f"[WAITING] Still need {total - len(assigned)} more clips. Run with --watch to continuously monitor.")
