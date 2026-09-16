import time
import os
import sys
import json
import urllib.request
import asyncio
from pathlib import Path

try:
    from . import config
    from . import tts_engine
    from . import subtitle_generator
    from . import motion_engine
    from . import video_composer
    from . import comfy_client
    from . import cloud_image_client
    from . import storage_uploader
except (ImportError, ValueError):
    import config
    import tts_engine
    import subtitle_generator
    import motion_engine
    import video_composer
    import comfy_client
    import cloud_image_client
    import storage_uploader

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
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
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
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())

def poll_pending_scenes():
    """Polls database for scenes needing rendering or regeneration"""
    endpoint = "manhwa_scenes?status=eq.pending&order=scene_order.asc&limit=5"
    return supabase_get(endpoint)

def update_scene_status(scene_id, updates):
    return supabase_patch(f"manhwa_scenes?id=eq.{scene_id}", updates)

def ensure_character_master_anchor(character_id):
    """
    Step 1 Consistency Anchor:
    Ensures a 3-view Master Character Sheet exists for character_id.
    If not, renders it using cloud Gemini 3.1 and saves to Supabase.
    """
    if not character_id:
        return None
    try:
        chars = supabase_get(f"manhwa_characters?id=eq.{character_id}&limit=1")
        if not chars:
            return None
        char = chars[0]
        char_name = char.get("name", "Protagonist")
        char_desc = char.get("appearance_locked_prompt", "")
        ref_url = char.get("reference_image_url")
        
        local_anchor = str(config.PANELS_DIR / f"character_{character_id}_master.png")
        if os.path.exists(local_anchor):
            return local_anchor
            
        if ref_url:
            try:
                urllib.request.urlretrieve(ref_url, local_anchor)
                return local_anchor
            except Exception:
                pass
                
        # Generate new Master Anchor Sheet via Cloud Image Client
        print(f"[Worker] Step 1: Generating Anchor Master Character Sheet for {char_name}...")
        cloud_image_client.generate_master_character_sheet(
            character_name=char_name,
            appearance_desc=char_desc,
            output_path=local_anchor
        )
        print(f"[Worker] Step 1 complete: Master Anchor saved to {local_anchor}")
        
        # Upload to Supabase Storage
        anchor_url = storage_uploader.upload_file(local_anchor, f"characters/{character_id}_master.png")
        print(f"[Worker] Master Anchor uploaded to: {anchor_url}")
        
        supabase_patch(f"manhwa_characters?id=eq.{character_id}", {
            "reference_image_url": anchor_url
        })
        return local_anchor
    except Exception as e:
        print(f"[Worker] Error generating/fetching character master anchor: {e}")
        return None

def get_character_reference_image(character_id, project_id, current_scene_order):
    """Finds or generates an anchor reference image for character consistency"""
    anchor = ensure_character_master_anchor(character_id)
    if anchor and os.path.exists(anchor):
        return anchor

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
            print(f"Error checking previous scene for reference: {e}")

    return None

async def assemble_project_if_ready(project_id):
    """Checks if all scenes for the project are ready, then concatenates with SFX and BGM"""
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

    # Get project metadata for BGM selection
    proj_info = {}
    try:
        proj_res = supabase_get(f"manhwa_projects?id=eq.{project_id}&limit=1")
        if proj_res:
            proj_info = proj_res[0]
    except Exception:
        pass

    # Create/update video job
    job_id = None
    try:
        existing_jobs = supabase_get(f"manhwa_video_jobs?project_id=eq.{project_id}&order=created_at.desc&limit=1")
        if existing_jobs:
            job_id = existing_jobs[0]["id"]
            supabase_patch(f"manhwa_video_jobs?id=eq.{job_id}", {"status": "stitching", "progress_percent": 85})
        else:
            new_job = supabase_post("manhwa_video_jobs", {
                "project_id": project_id,
                "status": "stitching",
                "progress_percent": 85
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
            p_path = str(config.PANELS_DIR / f"scene_{sc_id}.png")
            a_path = str(config.AUDIOS_DIR / f"scene_{sc_id}.mp3")
            s_path = str(config.SUBTITLES_DIR / f"scene_{sc_id}.ass")
            m_path = str(config.MOTIONS_DIR / f"scene_{sc_id}_motion.mp4")
            dur = sc.get("duration_seconds", 5.0)
            mot = sc.get("camera_motion", "zoom_in")
            if os.path.exists(p_path) and os.path.exists(a_path):
                video_composer.create_scene_video(
                    image_path=p_path,
                    audio_path=a_path,
                    duration=dur,
                    output_path=sc_vid,
                    motion=mot,
                    subtitle_path=s_path if os.path.exists(s_path) else None,
                    input_video_path=m_path if os.path.exists(m_path) else None
                )
        if os.path.exists(sc_vid):
            scene_videos.append(sc_vid)

    if len(scene_videos) != len(scenes):
        print(f"Warning: Expected {len(scenes)} scene videos, but found {len(scene_videos)}")

    # Resolve BGM preset from genre / style
    genre = str(proj_info.get("genre", "")).lower()
    bgm_preset = "epic_battle"
    if "mystery" in genre or "dungeon" in genre:
        bgm_preset = "mystery_dungeon"
    elif "sad" in genre or "melancholy" in genre or "romance" in genre or "villainess" in genre:
        bgm_preset = "melancholy_sad"

    scene_cues = [
        {"camera_motion": sc.get("camera_motion", "zoom_in"), "visual_prompt": sc.get("visual_prompt", "")}
        for sc in scenes
    ]

    final_local_video = str(config.OUTPUTS_DIR / f"episode_{project_id}.mp4")
    print(f"Concatenating {len(scene_videos)} scenes with SFX transitions & BGM '{bgm_preset}'...")
    video_composer.concat_scenes(
        scene_video_paths=scene_videos,
        final_output_path=final_local_video,
        bgm_preset=bgm_preset,
        bgm_volume=0.18,
        scene_cues=scene_cues
    )
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
            "status": "completed",
            "video_url": final_video_url
        })
        print(f"SUCCESS: Project {project_id} marked as completed in Supabase!")
    except Exception as e:
        print(f"Error marking project completed: {e}")

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
    
    # -------------------------------------------------------------
    # 1. Voice Synthesis (Edge-TTS) + Word-Level Boundary Extraction
    # -------------------------------------------------------------
    audio_path = str(config.AUDIOS_DIR / f"scene_{scene_id}.mp3")
    subtitle_path = str(config.SUBTITLES_DIR / f"scene_{scene_id}.ass")
    audio_public_url = scene.get('audio_url')
    duration = scene.get('duration_seconds') or 5.0

    # Only re-synthesize if audio_url is empty or local file missing
    if not audio_public_url or not os.path.exists(audio_path):
        print(f"1. Synthesizing voiceover with word timestamps: '{narration[:50]}...'")
        update_scene_status(scene_id, {"status": "generating_audio"})
        duration, word_events = await tts_engine.synthesize_voice(
            narration,
            audio_path,
            return_timestamps=True,
            engine=os.getenv("VOICE_ENGINE", config.DEFAULT_VOICE_ENGINE)
        )
        print(f"   Audio generated ({duration:.2f}s, {len(word_events)} words): {audio_path}")

        print(f"   Uploading audio to Supabase Storage...")
        audio_public_url = storage_uploader.upload_file(audio_path, f"audios/{scene_id}.mp3")
        print(f"   Audio URL: {audio_public_url}")

        # ---------------------------------------------------------
        # 2. Dynamic Subtitles (.ass) Generation
        # ---------------------------------------------------------
        print(f"2. Generating dynamic .ass subtitles with gold karaoke highlight...")
        subtitle_generator.generate_ass_subtitle(
            word_events=word_events,
            output_path=subtitle_path,
            max_words_per_line=3
        )
        print(f"   Subtitle generated: {subtitle_path}")
    else:
        print(f"1. Reusing existing audio: {audio_path} ({duration:.2f}s)")
        if not os.path.exists(subtitle_path):
            # Regenerate subtitle from voice if missing
            _, word_events = await tts_engine.synthesize_voice(narration, audio_path, return_timestamps=True)
            subtitle_generator.generate_ass_subtitle(word_events, subtitle_path, max_words_per_line=3)

    # -------------------------------------------------------------
    # 3. Visual Panel Render (2-Step Consistency)
    # -------------------------------------------------------------
    panel_path = str(config.PANELS_DIR / f"scene_{scene_id}.png")
    image_public_url = scene.get('image_url')

    if not image_public_url or not os.path.exists(panel_path):
        ref_image_path = get_character_reference_image(char_id, project_id, order)
        if ref_image_path:
            print(f"3. Character Consistency Lock active with reference: {ref_image_path}")
        else:
            print(f"3. Generating base panel (prompt locking mode)")

        update_scene_status(scene_id, {
            "status": "generating_image",
            "audio_url": audio_public_url,
            "duration_seconds": duration
        })
        
        # Primary: Cloud Image Client (9Router Gemini 3.1 Flash Image)
        # Fallback: ComfyUI Local SDXL
        try:
            print(f"   Rendering panel via Cloud Image Client: '{prompt[:70]}...'")
            cloud_image_client.generate_panel_cloud(
                prompt_text=prompt,
                negative_text=negative,
                output_path=panel_path,
                ref_image_path=ref_image_path
            )
            print(f"   Panel rendered: {panel_path}")
        except Exception as e_cloud:
            print(f"   Cloud render failed ({e_cloud}), falling back to local ComfyUI...")
            try:
                comfy_client.generate_panel(
                    prompt_text=prompt,
                    negative_text=negative,
                    output_path=panel_path,
                    ref_image_path=ref_image_path,
                    ipadapter_weight=0.75
                )
                print(f"   ComfyUI panel rendered: {panel_path}")
            except Exception as e_comfy:
                print(f"All image rendering failed: {e_comfy}")
                update_scene_status(scene_id, {"status": "failed", "error_message": str(e_comfy)})
                return

        # Upload panel to Supabase Storage
        print(f"   Uploading panel to Supabase Storage...")
        image_public_url = storage_uploader.upload_file(panel_path, f"panels/{scene_id}.png")
        print(f"   Image URL: {image_public_url}")
    else:
        print(f"3. Reusing existing panel: {panel_path}")

    # -------------------------------------------------------------
    # 4. High-Motion Engine (Image-to-Video Animation)
    # -------------------------------------------------------------
    raw_motion_path = str(config.MOTIONS_DIR / f"scene_{scene_id}_motion.mp4")
    print(f"4. Generating High-Motion clip ({motion}, {duration:.2f}s)...")
    update_scene_status(scene_id, {"status": "animating"})
    motion_video_path = await motion_engine.animate_panel(
        image_path=panel_path,
        camera_motion=motion,
        visual_prompt=prompt,
        duration=duration,
        output_path=raw_motion_path,
        mode="auto",
        image_url=image_public_url
    )
    print(f"   Motion clip ready: {motion_video_path}")

    # -------------------------------------------------------------
    # 5. Final Scene Compositing + Dynamic Subtitle Burn-In
    # -------------------------------------------------------------
    scene_video_path = str(config.OUTPUTS_DIR / f"scene_{scene_id}.mp4")
    print(f"5. Compositing Final Scene (Motion + Narration + Burned-in Subtitles)...")
    update_scene_status(scene_id, {"status": "compositing"})
    video_composer.create_scene_video(
        image_path=panel_path,
        audio_path=audio_path,
        duration=duration,
        output_path=scene_video_path,
        motion=motion,
        subtitle_path=subtitle_path,
        input_video_path=motion_video_path
    )
    print(f"   Final scene video composed: {scene_video_path}")

    # Mark scene as ready in Supabase
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
    print("Manhwa Studio Production Worker Started")
    print("Engine: 9Router Gemini + Playwright Motion + Edge-TTS + FFmpeg")
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
