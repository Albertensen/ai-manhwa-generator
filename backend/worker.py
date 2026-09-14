import os
import sys
import time
import asyncio
import urllib.request
import urllib.parse
import json
from pathlib import Path

try:
    from . import config, comfy_client, tts_engine, video_composer, storage_uploader
except (ImportError, ValueError):
    import config, comfy_client, tts_engine, video_composer, storage_uploader

def supabase_get(endpoint):
    url = f"{config.SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

def supabase_patch(endpoint, data):
    url = f"{config.SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='PATCH')
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

def supabase_post(endpoint, data):
    url = f"{config.SUPABASE_URL}/rest/v1/{endpoint}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

def poll_pending_scenes():
    try:
        scenes = supabase_get("manhwa_scenes?status=eq.pending&order=created_at.asc&limit=1")
        return scenes
    except Exception as e:
        print(f"Error polling pending scenes: {e}")
        return []

def update_scene_status(scene_id, updates):
    try:
        return supabase_patch(f"manhwa_scenes?id=eq.{scene_id}", updates)
    except Exception as e:
        print(f"Error updating scene {scene_id}: {e}")

def get_character_reference_image(character_id, project_id, current_scene_order):
    """Finds an existing reference image for character consistency (IP-Adapter)"""
    # 1. Check character's direct reference image
    if character_id:
        try:
            chars = supabase_get(f"manhwa_characters?id=eq.{character_id}&limit=1")
            if chars and chars[0].get("reference_image_url"):
                ref_url = chars[0]["reference_image_url"]
                local_ref = str(config.PANELS_DIR / f"char_ref_{character_id}.png")
                if not os.path.exists(local_ref):
                    urllib.request.urlretrieve(ref_url, local_ref)
                return local_ref
        except Exception as e:
            print(f"Error fetching character reference: {e}")

    # 2. If scene_order > 1, check if scene 1 panel exists locally
    if current_scene_order > 1:
        try:
            first_scenes = supabase_get(f"manhwa_scenes?project_id=eq.{project_id}&scene_order=eq.1&limit=1")
            if first_scenes:
                s1_id = first_scenes[0]["id"]
                s1_panel = str(config.PANELS_DIR / f"scene_{s1_id}.png")
                if os.path.exists(s1_panel):
                    return s1_panel
                elif first_scenes[0].get("image_url"):
                    urllib.request.urlretrieve(first_scenes[0]["image_url"], s1_panel)
                    return s1_panel
        except Exception as e:
            print(f"Error checking previous scene for IP-Adapter ref: {e}")

    return None

async def assemble_project_if_ready(project_id):
    """Checks if all scenes for the project are ready, then concatenates with BGM"""
    try:
        scenes = supabase_get(f"manhwa_scenes?project_id=eq.{project_id}&order=scene_order.asc")
    except Exception as e:
        print(f"Error fetching project scenes: {e}")
        return

    if not scenes:
        return

    # Check if all scenes are ready
    all_ready = all(s.get("status") == "ready" for s in scenes)
    if not all_ready:
        pending_cnt = sum(1 for s in scenes if s.get("status") != "ready")
        print(f"Project {project_id}: {len(scenes) - pending_cnt}/{len(scenes)} scenes ready.")
        return

    print(f"\n=======================================================")
    print(f"ALL {len(scenes)} SCENES READY! Assembling Full Episode Video...")
    print(f"=======================================================")

    # Create/update video job
    job_id = None
    try:
        existing_jobs = supabase_get(f"manhwa_video_jobs?project_id=eq.{project_id}&order=created_at.desc&limit=1")
        if existing_jobs:
            job_id = existing_jobs[0]["id"]
            supabase_patch(f"manhwa_video_jobs?id=eq.{job_id}", {"status": "rendering", "progress_percent": 80})
        else:
            new_job = supabase_post("manhwa_video_jobs", {
                "project_id": project_id,
                "status": "rendering",
                "progress_percent": 80
            })
            if new_job:
                job_id = new_job[0]["id"]
    except Exception as e:
        print(f"Error updating video job status: {e}")

    scene_videos = []
    for sc in scenes:
        sc_id = sc["id"]
        sc_vid = str(config.OUTPUTS_DIR / f"scene_{sc_id}.mp4")
        if not os.path.exists(sc_vid):
            # Regenerate scene video if missing
            p_path = str(config.PANELS_DIR / f"scene_{sc_id}.png")
            a_path = str(config.AUDIOS_DIR / f"scene_{sc_id}.mp3")
            dur = sc.get("duration_seconds", 5.0)
            mot = sc.get("camera_motion", "zoom_in")
            if os.path.exists(p_path) and os.path.exists(a_path):
                video_composer.create_scene_video(p_path, a_path, dur, sc_vid, motion=mot)
        if os.path.exists(sc_vid):
            scene_videos.append(sc_vid)

    if len(scene_videos) != len(scenes):
        print(f"Warning: Expected {len(scenes)} scene videos, but found {len(scene_videos)}")

    final_local_video = str(config.OUTPUTS_DIR / f"episode_{project_id}.mp4")
    print(f"Concatenating {len(scene_videos)} scenes with dramatic BGM (18% volume)...")
    video_composer.concat_scenes(scene_videos, final_local_video, bgm_volume=0.18)
    print(f"Episode video assembled: {final_local_video}")

    # Upload to Supabase Storage
    print(f"Uploading final episode to Supabase Storage bucket 'manhwa-assets'...")
    final_video_url = storage_uploader.upload_file(final_local_video, f"videos/{project_id}.mp4")
    print(f"Public Episode Video URL: {final_video_url}")

    # Update manhwa_video_jobs & manhwa_projects
    try:
        if job_id:
            supabase_patch(f"manhwa_video_jobs?id=eq.{job_id}", {
                "status": "completed",
                "progress_percent": 100,
                "video_url": final_video_url
            })
        else:
            supabase_post("manhwa_video_jobs", {
                "project_id": project_id,
                "status": "completed",
                "progress_percent": 100,
                "video_url": final_video_url
            })

        supabase_patch(f"manhwa_projects?id=eq.{project_id}", {
            "status": "completed"
        })
        print(f"SUCCESS: Project {project_id} marked as completed in Supabase!")
    except Exception as e:
        print(f"Error finalizing project record: {e}")

async def process_scene(scene):
    scene_id = scene['id']
    project_id = scene.get('project_id')
    order = scene.get('scene_order', 1)
    prompt = scene.get('visual_prompt', '')
    negative = scene.get('negative_prompt', '')
    narration = scene.get('narration_text', '')
    motion = scene.get('camera_motion', 'zoom_in')
    char_id = scene.get('character_id')
    
    print(f"\n=======================================================")
    print(f"Processing Scene {order} (ID: {scene_id})")
    print(f"=======================================================")
    
    # 1. Voice Synthesis (Edge-TTS)
    audio_path = str(config.AUDIOS_DIR / f"scene_{scene_id}.mp3")
    print(f"1. Synthesizing voiceover: '{narration[:50]}...'")
    update_scene_status(scene_id, {"status": "generating_audio"})
    duration = await tts_engine.synthesize_voice(narration, audio_path)
    print(f"   Audio generated ({duration:.2f}s): {audio_path}")

    # Upload audio to Supabase Storage
    print(f"   Uploading audio to Supabase Storage...")
    audio_public_url = storage_uploader.upload_file(audio_path, f"audios/{scene_id}.mp3")
    print(f"   Audio URL: {audio_public_url}")

    # 2. Check for IP-Adapter Character Consistency Reference
    ref_image_path = get_character_reference_image(char_id, project_id, order)
    if ref_image_path:
        print(f"2. IP-Adapter Character Lock active with reference: {ref_image_path}")
    else:
        print(f"2. Generating base panel (character prompt locking mode)")

    # 3. Image Render (ComfyUI SDXL Animagine XL)
    panel_path = str(config.PANELS_DIR / f"scene_{scene_id}.png")
    update_scene_status(scene_id, {
        "status": "generating_image",
        "audio_url": audio_public_url,
        "duration_seconds": duration
    })
    
    try:
        print(f"3. Rendering panel via ComfyUI SDXL: '{prompt[:70]}...'")
        comfy_client.generate_panel(
            prompt_text=prompt,
            negative_text=negative,
            output_path=panel_path,
            ref_image_path=ref_image_path,
            ipadapter_weight=0.75
        )
        print(f"   Panel rendered: {panel_path}")
    except Exception as e:
        print(f"ComfyUI render failed: {e}")
        update_scene_status(scene_id, {"status": "failed", "error_message": str(e)})
        return

    # Upload panel to Supabase Storage
    print(f"   Uploading panel to Supabase Storage...")
    image_public_url = storage_uploader.upload_file(panel_path, f"panels/{scene_id}.png")
    print(f"   Image URL: {image_public_url}")

    # 4. Compose Single Scene Video (Ken Burns + synced narration)
    scene_video_path = str(config.OUTPUTS_DIR / f"scene_{scene_id}.mp4")
    print(f"4. Composing Scene Video ({motion}, duration {duration:.2f}s)...")
    video_composer.create_scene_video(panel_path, audio_path, duration, scene_video_path, motion=motion)
    print(f"   Scene video composed: {scene_video_path}")

    # Mark scene as ready
    update_scene_status(scene_id, {
        "status": "ready",
        "image_url": image_public_url,
        "audio_url": audio_public_url,
        "duration_seconds": duration
    })
    print(f"Scene {order} complete and marked 'ready' in Supabase!")

    # Check if full project is ready to assemble
    if project_id:
        await assemble_project_if_ready(project_id)

async def main_loop():
    print("=======================================================")
    print("Manhwa Studio Local Worker Started (ComfyUI + RTX 3060 Ti)")
    print("Polling pending scenes from Supabase queue...")
    print("=======================================================")
    while True:
        try:
            scenes = poll_pending_scenes()
            if scenes:
                for s in scenes:
                    await process_scene(s)
        except Exception as e:
            print(f"Worker loop error: {e}")
        await asyncio.sleep(4)

if __name__ == "__main__":
    asyncio.run(main_loop())
