import os
import sys
import time
import asyncio
import json
import urllib.request
from pathlib import Path

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

try:
    from . import config, comfy_client, tts_engine, video_composer, storage_uploader
except (ImportError, ValueError):
    import config, comfy_client, tts_engine, video_composer, storage_uploader

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

async def run_smoke_test():
    total_start_time = time.time()
    timings = {}
    
    print("=" * 70, flush=True)
    print("  AI MANHWA & ANIME RECAP GENERATOR - QUICK SMOKE TEST", flush=True)
    print("  NVIDIA GeForce RTX 3060 Ti | ComfyUI SDXL | IP-Adapter | Edge-TTS", flush=True)
    print("=" * 70, flush=True)
    
    # --- STEP 1: Provision Project & Scenes in Supabase ---
    print("\n[Step 1/5] Creating Smoke Test Episode in Supabase...", flush=True)
    step1_start = time.time()
    
    character_name = "Kaelen"
    char_lock_prompt = (
        "1boy, solo, messy silver hair, glowing bright blue eyes, pale skin, cold sharp expression, "
        "dark ripped hunter coat, dark fantasy manhwa webtoon art style, highly detailed illustration, 8k resolution"
    )
    
    project_payload = {
        "title": "Kebangkitan Belati Bayangan: Dendam Kaelen",
        "synopsis": "Kaelen, pemburu peringkat terendah berambut perak dengan mata biru menyala, dikhianati rekan timnya di dalam dungeon bawah tanah lalu membangkitkan belati bayangan kuno.",
        "genre": "Dark Fantasy Action",
        "art_style": "korean_webtoon_hq",
        "status": "rendering"
    }
    project = supabase_post("manhwa_projects", project_payload)[0]
    project_id = project["id"]
    print(f" -> Created Project ID: {project_id}", flush=True)
    
    char_payload = {
        "project_id": project_id,
        "name": character_name,
        "role": "protagonist",
        "appearance_locked_prompt": char_lock_prompt
    }
    character = supabase_post("manhwa_characters", char_payload)[0]
    char_id = character["id"]
    print(f" -> Created Character: {character_name} (ID: {char_id})", flush=True)
    
    scenes_defs = [
        {
            "scene_order": 1,
            "motion": "zoom_in",
            "voice_emotion": "dramatic",
            "narration": "Di kedalaman jurang dungeon bawah tanah yang sunyi dan dingin, Kaelen tergeletak bersimbah darah. Dikhianati dan ditinggalkan mati oleh rekan timnya sendiri, kegelapan pekat perlahan mulai mengepung tubuhnya.",
            "visual_prompt": (
                f"{char_lock_prompt}, blood on cheek, dark ripped hunter coat, injured, "
                "lying on cold dark stone floor of deep underground dungeon, looming shadow demons in background, "
                "eerie dark blue lighting, dramatic low angle perspective, solo leveling style"
            ),
            "negative_prompt": "text, speech bubble, watermark, logo, blurry, deformed hands, bad anatomy, ugly face, extra limbs, lowres"
        },
        {
            "scene_order": 2,
            "motion": "pan_left",
            "voice_emotion": "intense",
            "narration": "Namun tepat sebelum napas terakhirnya habis, tetesan darahnya mengaktifkan belati kuno yang tertancap di tanah. Aura ungu pekat menyembur dahsyat, membangkitkan kekuatan bayangan yang tertidur ribuan tahun!",
            "visual_prompt": (
                f"{char_lock_prompt}, standing up, wielding ancient shadow dagger, "
                "intense dark purple swirling aura, purple lightning miasma rising from blade, "
                "dynamic battle pose, glowing particles, dramatic combat angle"
            ),
            "negative_prompt": "text, speech bubble, watermark, logo, blurry, deformed hands, bad anatomy, ugly face, extra limbs, lowres"
        },
        {
            "scene_order": 3,
            "motion": "zoom_in",
            "voice_emotion": "dramatic",
            "narration": "Kaelen mengangkat wajahnya, menatap lurus ke depan dengan seringai dingin membunuh. Pengkhianatan mereka tidak mengakhiri hidupnya, melainkan melahirkan mimpi buruk terburuk bagi mereka.",
            "visual_prompt": (
                f"{char_lock_prompt}, extreme close-up face shot, cold sinister smirk, "
                "sharp jawline, intense penetrating gaze directly at camera, purple shadow mist dissipating in background, "
                "cinematic rim lighting, high contrast manhwa illustration"
            ),
            "negative_prompt": "text, speech bubble, watermark, logo, blurry, deformed hands, bad anatomy, ugly face, extra limbs, lowres"
        }
    ]
    
    scene_records = []
    for s in scenes_defs:
        payload = {
            "project_id": project_id,
            "character_id": char_id,
            "scene_order": s["scene_order"],
            "character_name": character_name,
            "narration_text": s["narration"],
            "visual_prompt": s["visual_prompt"],
            "negative_prompt": s["negative_prompt"],
            "camera_motion": s["motion"],
            "voice_emotion": s["voice_emotion"],
            "status": "rendering"
        }
        rec = supabase_post("manhwa_scenes", payload)[0]
        scene_records.append(rec)
        print(f" -> Created Scene {s['scene_order']} Record (ID: {rec['id']})", flush=True)
        
    timings["step1_supabase_provision"] = time.time() - step1_start

    # --- STEP 2: Render Scenes (TTS + ComfyUI + IP-Adapter + Ken Burns) ---
    print("\n[Step 2/5] Rendering 3 Manhwa Scenes...", flush=True)
    scene_video_paths = []
    scene_public_panels = []
    scene_public_audios = []
    
    base_character_panel_path = None
    
    for idx, sc_def in enumerate(scenes_defs):
        sc_rec = scene_records[idx]
        sc_id = sc_rec["id"]
        order = sc_def["scene_order"]
        motion = sc_def["motion"]
        narration = sc_def["narration"]
        prompt = sc_def["visual_prompt"]
        neg = sc_def["negative_prompt"]
        
        print(f"\n--- Processing Scene {order}/3 (ID: {sc_id}) ---", flush=True)
        sc_start = time.time()
        
        # 1. Edge-TTS Audio
        t0 = time.time()
        audio_local = str(config.AUDIOS_DIR / f"scene_{sc_id}.mp3")
        print(f" [1/4] Synthesizing Voice (id-ID-ArdiNeural): '{narration[:45]}...'", flush=True)
        duration = await tts_engine.synthesize_voice(narration, audio_local)
        t_tts = time.time() - t0
        print(f"       Generated {duration:.2f}s audio in {t_tts:.2f}s", flush=True)
        
        # Upload Audio
        t0 = time.time()
        audio_url = storage_uploader.upload_file(audio_local, f"audios/{sc_id}.mp3")
        t_up_a = time.time() - t0
        scene_public_audios.append(audio_url)
        print(f"       Uploaded Audio -> {audio_url}", flush=True)
        
        # 2. ComfyUI Image Render (with IP-Adapter on Scene 2 & 3)
        panel_local = str(config.PANELS_DIR / f"scene_{sc_id}.png")
        ref_image = base_character_panel_path if order > 1 else None
        
        if ref_image:
            print(f" [2/4] Rendering SDXL with IP-Adapter Character Consistency (Ref: {os.path.basename(ref_image)})...", flush=True)
        else:
            print(f" [2/4] Rendering Base SDXL Character Panel...", flush=True)
            
        t0 = time.time()
        comfy_client.generate_panel(
            prompt_text=prompt,
            negative_text=neg,
            output_path=panel_local,
            ref_image_path=ref_image,
            ipadapter_weight=0.72
        )
        t_render = time.time() - t0
        print(f"       Rendered 832x1216 panel in {t_render:.2f}s", flush=True)
        
        if order == 1:
            base_character_panel_path = panel_local
            print(f"       >>> LOCKED BASE CHARACTER REFERENCE: {base_character_panel_path} <<<", flush=True)
            
        # Upload Panel
        t0 = time.time()
        panel_url = storage_uploader.upload_file(panel_local, f"panels/{sc_id}.png")
        t_up_p = time.time() - t0
        scene_public_panels.append(panel_url)
        print(f"       Uploaded Panel -> {panel_url}", flush=True)
        
        # 3. FFmpeg Scene Clip
        t0 = time.time()
        sc_vid_local = str(config.OUTPUTS_DIR / f"scene_{sc_id}.mp4")
        print(f" [3/4] Compositing Scene Clip (Motion: {motion}, Duration: {duration:.2f}s)...", flush=True)
        video_composer.create_scene_video(panel_local, audio_local, duration, sc_vid_local, motion=motion)
        t_vid = time.time() - t0
        scene_video_paths.append(sc_vid_local)
        print(f"       Composited Ken Burns video in {t_vid:.2f}s", flush=True)
        
        # 4. Update Supabase Scene
        print(f" [4/4] Updating Supabase scene record to 'ready'...", flush=True)
        supabase_patch(f"manhwa_scenes?id=eq.{sc_id}", {
            "status": "ready",
            "image_url": panel_url,
            "audio_url": audio_url,
            "duration_seconds": duration
        })
        
        sc_total = time.time() - sc_start
        timings[f"scene_{order}_total"] = sc_total
        timings[f"scene_{order}_tts"] = t_tts
        timings[f"scene_{order}_render"] = t_render
        timings[f"scene_{order}_video"] = t_vid

    # --- STEP 3: Assemble Full Episode with BGM ---
    print("\n[Step 3/5] Assembling Full Episode Video with Dramatic BGM...", flush=True)
    t0 = time.time()
    final_video_local = str(config.OUTPUTS_DIR / f"episode_{project_id}.mp4")
    video_composer.concat_scenes(scene_video_paths, final_video_local, bgm_volume=0.18)
    t_concat = time.time() - t0
    timings["concat_and_bgm_mix"] = t_concat
    print(f" -> Full episode stitched with 18% ambient BGM in {t_concat:.2f}s", flush=True)
    print(f" -> File size: {os.path.getsize(final_video_local):,} bytes", flush=True)

    # --- STEP 4: Upload Final Video to Supabase Storage ---
    print("\n[Step 4/5] Uploading Final Episode MP4 to Supabase Storage...", flush=True)
    t0 = time.time()
    final_video_url = storage_uploader.upload_file(final_video_local, f"videos/{project_id}.mp4")
    t_up_v = time.time() - t0
    timings["video_upload"] = t_up_v
    print(f" -> Public Video URL: {final_video_url}", flush=True)

    # --- STEP 5: Finalize Project & Video Job in Supabase ---
    print("\n[Step 5/5] Finalizing Supabase Database Records...", flush=True)
    supabase_post("manhwa_video_jobs", {
        "project_id": project_id,
        "status": "completed",
        "progress_percent": 100,
        "video_url": final_video_url
    })
    supabase_patch(f"manhwa_projects?id=eq.{project_id}", {
        "status": "completed"
    })
    
    total_elapsed = time.time() - total_start_time
    timings["total_pipeline_time"] = total_elapsed

    # --- PRINT FINAL REPORT ---
    print("\n" + "=" * 70, flush=True)
    print("                  SMOKE TEST EXECUTION REPORT", flush=True)
    print("=" * 70, flush=True)
    print(f"Project Title: {project_payload['title']}", flush=True)
    print(f"Project ID:    {project_id}", flush=True)
    print(f"Character:     {character_name} (Locked via IP-Adapter)", flush=True)
    print(f"Total Time:    {total_elapsed:.2f} seconds ({total_elapsed/60:.2f} minutes)", flush=True)
    print("-" * 70, flush=True)
    print("PUBLIC ASSET URLS:", flush=True)
    for idx, p_url in enumerate(scene_public_panels, 1):
        print(f" * Panel {idx} PNG:  {p_url}", flush=True)
    print(f"\n * Final Episode MP4: {final_video_url}", flush=True)
    print("-" * 70, flush=True)
    print("PERFORMANCE BREAKDOWN:", flush=True)
    for k, v in timings.items():
        print(f" - {k:<28}: {v:>6.2f} s", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    asyncio.run(run_smoke_test())
