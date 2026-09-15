"""
AI Manhwa Recap Generator - Auto Ingest Worker (Isolated & Validated Mode)
Monitors dedicated project drop directories for browser-generated I2V clips (Google Flow + Meta AI),
strictly validates file timestamps against project creation time, prevents premature stitching,
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
from datetime import datetime, timezone
from pathlib import Path

# Load config and backend modules
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
ARCHIVE_DIR = STORAGE_DIR / "trash_or_archive"
WIN_DOWNLOADS_DIR = Path.home() / "Downloads"

for d in [RAW_DOWNLOADS_DIR, PROJECT_CLIPS_DIR, ARCHIVE_DIR, config.OUTPUTS_DIR, config.AUDIOS_DIR, config.SUBTITLES_DIR]:
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


def parse_iso_timestamp(ts_str: str) -> float:
    """Parses ISO timestamp string to unix epoch seconds."""
    if not ts_str:
        return 0.0
    try:
        # Replace Z with +00:00 for python fromisoformat
        clean_ts = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_ts)
        return dt.timestamp()
    except Exception:
        return 0.0


def find_latest_active_project(project_id_arg: str = None, project_file_arg: str = None):
    """
    Finds active project metadata from:
    1. Specified project_file (.json)
    2. Any manhwa_project_*.json in project drop folders
    3. Specified project_id in Supabase
    4. Latest in-progress project in Supabase
    """
    # 1. Project file provided
    if project_file_arg and os.path.exists(project_file_arg):
        with open(project_file_arg, "r", encoding="utf-8") as f:
            return json.load(f)

    # 2. Look for project json package in raw_downloads
    pkg_files = sorted(
        glob.glob(str(RAW_DOWNLOADS_DIR / "manhwa_project_*.json")),
        key=os.path.getmtime,
        reverse=True
    )
    if pkg_files:
        target_json = pkg_files[0]
        with open(target_json, "r", encoding="utf-8") as f:
            data = json.load(f)
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
        # Fetch latest project not completed
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


def is_valid_video_file(file_path: Path) -> bool:
    """Verifies that the file exists, has size > 15KB, and has valid media stream."""
    try:
        if not file_path.exists():
            return False
        if file_path.stat().st_size < 15000:
            return False
        dur = video_composer.get_media_duration(str(file_path))
        return dur > 0.5
    except Exception:
        return False


def scan_and_sort_clips(
    project_id: str,
    total_scenes: int,
    min_timestamp: float,
    scan_windows_downloads: bool = False
):
    """
    Strictly scans:
    1. Primary: storage/raw_downloads/{project_id}/
    2. Secondary: storage/raw_downloads/
    3. (Optional) Windows Downloads with strict keyword + timestamp filter.
    
    Rejects any file with mtime < min_timestamp.
    Returns: (assigned_dict, candidate_details_list)
    """
    proj_raw_dir = RAW_DOWNLOADS_DIR / project_id
    proj_raw_dir.mkdir(parents=True, exist_ok=True)
    p_dir = PROJECT_CLIPS_DIR / project_id
    p_dir.mkdir(parents=True, exist_ok=True)

    # Check already verified scene clips in project_clips
    existing_scenes = {}
    for i in range(1, total_scenes + 1):
        target = p_dir / f"scene_{i:03d}.mp4"
        if is_valid_video_file(target):
            # Check if this clip was created after min_timestamp
            if target.stat().st_mtime >= min_timestamp:
                existing_scenes[i] = target

    video_exts = [".mp4", ".webm", ".mov", ".mkv"]
    search_dirs = [proj_raw_dir, RAW_DOWNLOADS_DIR]
    if scan_windows_downloads and WIN_DOWNLOADS_DIR.exists():
        search_dirs.append(WIN_DOWNLOADS_DIR)

    candidates = []
    seen_paths = set()

    for s_dir in search_dirs:
        if not s_dir.exists():
            continue
        is_win_dl = (s_dir == WIN_DOWNLOADS_DIR)
        
        for ext in video_exts:
            for f_path in s_dir.glob(f"*{ext}"):
                if f_path in seen_paths:
                    continue
                seen_paths.add(f_path)

                # Skip partial downloads
                if f_path.name.endswith(".crdownload") or f_path.name.startswith("~"):
                    continue

                # Skip if already in project_clips
                if str(p_dir) in str(f_path):
                    continue

                try:
                    f_stat = f_path.stat()
                    # Rule: Reject files older than min_timestamp
                    if f_stat.st_mtime < min_timestamp:
                        continue

                    # If scanning general Windows Downloads, require explicit keywords
                    if is_win_dl:
                        name_lower = f_path.name.lower()
                        keywords = ["meta", "ai", "animate", "flow", "scene", "manhwa", project_id[:8].lower()]
                        if not any(k in name_lower for k in keywords):
                            continue

                    # Validate file size and readability
                    if not is_valid_video_file(f_path):
                        continue

                    candidates.append((f_path, f_stat.st_mtime, f_stat.st_size))
                except Exception:
                    continue

    # Sort candidates by filename index if present, else by modification time
    import re
    def sort_key(item):
        path, mtime, _ = item
        name = path.stem.lower()
        nums = re.findall(r"\d+", name)
        if nums:
            return (0, int(nums[-1]), mtime)
        return (1, 0, mtime)

    candidates.sort(key=sort_key)

    # Assign candidates to missing scene slots
    assigned = dict(existing_scenes)
    candidate_details = []

    cand_idx = 0
    for i in range(1, total_scenes + 1):
        if i in assigned:
            c_file = assigned[i]
            candidate_details.append({
                "scene": i,
                "file": c_file.name,
                "path": str(c_file),
                "size_mb": c_file.stat().st_size / (1024 * 1024),
                "mtime": datetime.fromtimestamp(c_file.stat().st_mtime).strftime("%H:%M:%S"),
                "status": "ready"
            })
            continue

        if cand_idx < len(candidates):
            src_file, mtime_val, size_val = candidates[cand_idx]
            dst_file = p_dir / f"scene_{i:03d}.mp4"
            print(f"[INGEST] Pairing '{src_file.name}' -> scene_{i:03d}.mp4 (size={size_val/(1024*1024):.2f}MB)")
            shutil.copy2(src_file, dst_file)
            assigned[i] = dst_file
            candidate_details.append({
                "scene": i,
                "file": src_file.name,
                "path": str(dst_file),
                "size_mb": size_val / (1024 * 1024),
                "mtime": datetime.fromtimestamp(mtime_val).strftime("%H:%M:%S"),
                "status": "ingested"
            })
            cand_idx += 1
        else:
            candidate_details.append({
                "scene": i,
                "file": None,
                "path": None,
                "size_mb": 0,
                "mtime": "-",
                "status": "waiting"
            })

    return assigned, candidate_details


def optimize_web_mp4(input_path: str, output_path: str) -> str:
    """Ensures faststart and compresses to <48MB if needed for Supabase CDN streaming."""
    size_mb = os.path.getsize(input_path) / (1024 * 1024)
    print(f"[OPTIMIZE] Source size: {size_mb:.2f} MB")
    
    if size_mb > 48.0:
        print("[OPTIMIZE] Compressing with libx264 CRF 25 + faststart...")
        cmd = [
            config.FFMPEG_BIN, "-y",
            "-fflags", "+genpts",
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
            "-fflags", "+genpts",
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

        subtitle_generator.generate_ass_subtitle(
            word_events=word_events,
            output_path=str(sub_path),
            margin_v=480
        )

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
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase_patch(f"manhwa_projects?id=eq.{project_id}", {
        "status": "completed",
        "updated_at": now_iso
    })

    existing_jobs = supabase_get(f"manhwa_video_jobs?project_id=eq.{project_id}")
    if existing_jobs and len(existing_jobs) > 0:
        supabase_patch(f"manhwa_video_jobs?project_id=eq.{project_id}", {
            "status": "completed",
            "progress_percent": 100,
            "video_url": cdn_url,
            "updated_at": now_iso
        })
    else:
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
            req = urllib.request.Request(post_url, data=post_data, headers=post_headers, method="POST")
            with urllib.request.urlopen(req) as res:
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


def run_watcher(
    poll_interval: int = 4,
    project_id: str = None,
    project_file: str = None,
    clean_start: bool = True,
    scan_downloads: bool = False,
    force_assemble: bool = False
):
    """Continuous folder monitoring watcher loop with strict isolation and timestamp validation."""
    startup_time = time.time() if clean_start else 0.0

    print("\n" + "=" * 66)
    print("  MANHWA GENERATOR - AUTO INGEST WATCHER (ISOLATED MODE)")
    print("=" * 66)

    # Initial Project Discovery
    project = find_latest_active_project(project_id, project_file)
    if not project:
        print("[ERROR] No active project found in database or downloads.")
        print("[HELP] Create a project on Vercel Web Studio first or pass --project-id.")
        return

    p_id = project.get("project_id") or project.get("id")
    title = project.get("title", "Manhwa Project")
    scenes = project.get("scenes", [])
    total_scenes = len(scenes)
    created_at_str = project.get("created_at", "")
    project_created_ts = parse_iso_timestamp(created_at_str)

    # Minimum timestamp is either project creation time or watcher startup time
    effective_min_ts = max(project_created_ts, startup_time)

    primary_drop_dir = RAW_DOWNLOADS_DIR / p_id
    primary_drop_dir.mkdir(parents=True, exist_ok=True)

    print(f"Active Project   : {title}")
    print(f"Project ID       : {p_id}")
    print(f"Project Created  : {created_at_str}")
    print(f"Required Scenes  : {total_scenes} clips (scene_001.mp4 ... scene_{total_scenes:03d}.mp4)")
    print(f"Startup Time     : {datetime.fromtimestamp(startup_time).strftime('%Y-%m-%d %H:%M:%S') if startup_time else 'Any'}")
    print(f"Timestamp Filter : Rejecting any files created before {datetime.fromtimestamp(effective_min_ts).strftime('%H:%M:%S')}")
    print("-" * 66)
    print("Input Drop Folders:")
    print(f" [1] PRIMARY (Project): {primary_drop_dir}")
    print(f" [2] SECONDARY (Drop) : {RAW_DOWNLOADS_DIR}")
    if scan_downloads:
        print(f" [3] WIN DOWNLOADS    : {WIN_DOWNLOADS_DIR} (Strict keyword/timestamp filter)")
    else:
        print(" [3] WIN DOWNLOADS    : Ignored (Isolated mode. Move clips to folder [1] or [2])")
    print("-" * 66)
    print(f"[STATUS] LISTENING for fresh clips... (Polling every {poll_interval}s)")
    print("=" * 66 + "\n")

    last_reported_count = -1
    notified_ready = False

    while True:
        try:
            # Refresh project info if needed
            if not scenes:
                project = find_latest_active_project(project_id, project_file)
                scenes = project.get("scenes", [])
                total_scenes = len(scenes)

            assigned, details = scan_and_sort_clips(
                project_id=p_id,
                total_scenes=total_scenes,
                min_timestamp=effective_min_ts,
                scan_windows_downloads=scan_downloads
            )

            current_count = len(assigned)

            if current_count != last_reported_count:
                last_reported_count = current_count
                now_str = datetime.now().strftime("%H:%M:%S")
                print(f"\n[WATCHER {now_str}] Status: {current_count}/{total_scenes} clips verified.")
                for d in details:
                    st_icon = "[OK]" if d["status"] in ("ready", "ingested") else "[..]"
                    f_name = d["file"] or "Missing clip"
                    print(f"  {st_icon} Scene {d['scene']}: {f_name} ({d['size_mb']:.2f}MB, {d['mtime']})")

            # Check if all scenes are ready
            if current_count >= total_scenes and total_scenes > 0:
                # Query DB to check if user clicked "Assemble Final Episode" in Web Studio
                proj_db = supabase_get(f"manhwa_projects?id=eq.{p_id}&limit=1")
                proj_status = proj_db[0].get("status") if proj_db else project.get("status")
                jobs_db = supabase_get(f"manhwa_video_jobs?project_id=eq.{p_id}&order=created_at.desc&limit=1")
                job_status = jobs_db[0].get("status") if jobs_db else ""

                should_assemble = (
                    force_assemble or
                    proj_status in ("stitching", "rendering") or
                    job_status in ("pending_assembly", "stitching")
                )

                if should_assemble:
                    print("\n" + "#" * 66)
                    print(f"[ASSEMBLE TRIGGERED] Web Studio requested final assembly for '{title}'!")
                    print(f"[COUNTDOWN] Finalize pipeline starting in 3 seconds...")
                    print("#" * 66)
                    time.sleep(3)
                    asyncio.run(finalize_project(project))
                    print("\n[WATCHER] Production complete. Continuing to listen...")
                    last_reported_count = -1
                    effective_min_ts = time.time()
                else:
                    if not notified_ready:
                        print(f"\n[READY] All {total_scenes} clips are present and verified in drop folder!")
                        print(f"[WAITING FOR USER] Buka Web Studio Step 5 dan klik 'Assemble Final Episode' untuk mulai merakit.\n")
                        notified_ready = True

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
    parser.add_argument("--clean-start", action="store_true", default=True, help="Ignore files created before startup")
    parser.add_argument("--scan-downloads", action="store_true", default=False, help="Also scan Windows Downloads folder with strict filter")
    parser.add_argument("--force-assemble", action="store_true", default=False, help="Immediately assemble when clips ready without waiting for Web Studio click")
    args = parser.parse_args()

    if args.watch:
        run_watcher(
            poll_interval=args.poll_interval,
            project_id=args.project_id,
            project_file=args.project_file,
            clean_start=args.clean_start,
            scan_downloads=args.scan_downloads,
            force_assemble=args.force_assemble
        )
    else:
        proj = find_latest_active_project(args.project_id, args.project_file)
        if not proj:
            print("[ERROR] No active project found.")
            sys.exit(1)
        p_id = proj.get("project_id") or proj.get("id")
        total = len(proj.get("scenes", []))
        created_ts = parse_iso_timestamp(proj.get("created_at", ""))
        print(f"[INFO] Active Project: '{proj.get('title')}' ({p_id}) with {total} scenes.")
        assigned, details = scan_and_sort_clips(
            project_id=p_id,
            total_scenes=total,
            min_timestamp=created_ts,
            scan_windows_downloads=args.scan_downloads
        )
        print(f"[INFO] Verified clips: {len(assigned)}/{total}")
        for d in details:
            print(f"  Scene {d['scene']}: {d['file']} ({d['status']})")
        if len(assigned) >= total and total > 0:
            asyncio.run(finalize_project(proj))
        else:
            print(f"[WAITING] Missing {total - len(assigned)} clips. Run with --watch to monitor.")
