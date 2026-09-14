import os
import sys
import time
import asyncio
import urllib.request
import json
from . import config, comfy_client, tts_engine, video_composer

def poll_pending_scenes():
    url = f"{config.SUPABASE_URL}/rest/v1/manhwa_scenes?status=eq.pending&order=created_at.asc&limit=1"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"Error polling scenes: {e}")
        return []

def update_scene(scene_id, updates):
    url = f"{config.SUPABASE_URL}/rest/v1/manhwa_scenes?id=eq.{scene_id}"
    headers = {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    req = urllib.request.Request(url, data=json.dumps(updates).encode('utf-8'), headers=headers, method='PATCH')
    try:
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())
    except Exception as e:
        print(f"Error updating scene {scene_id}: {e}")

async def process_scene(scene):
    scene_id = scene['id']
    order = scene.get('scene_order', 1)
    prompt = scene.get('visual_prompt', '')
    negative = scene.get('negative_prompt', '')
    narration = scene.get('narration_text', '')
    motion = scene.get('camera_motion', 'zoom_in')
    
    print(f"=== Processing Scene {order} (ID: {scene_id}) ===")
    
    # 1. Voice Synthesis
    audio_path = str(config.AUDIOS_DIR / f"scene_{scene_id}.mp3")
    print(f"Synthesizing voiceover: '{narration[:40]}...'")
    update_scene(scene_id, {"status": "generating_audio"})
    duration = await tts_engine.synthesize_voice(narration, audio_path)
    print(f"Audio ready ({duration:.2f}s): {audio_path}")
    
    # 2. Image Render (ComfyUI)
    panel_path = str(config.PANELS_DIR / f"scene_{scene_id}.png")
    update_scene(scene_id, {"status": "generating_image", "audio_url": audio_path, "duration_seconds": duration})
    
    try:
        print(f"Rendering panel via ComfyUI: '{prompt[:60]}...'")
        comfy_client.generate_panel(prompt, negative, panel_path)
        print(f"Panel rendered: {panel_path}")
        update_scene(scene_id, {"status": "ready", "image_url": panel_path})
    except Exception as e:
        print(f"ComfyUI render failed: {e}")
        update_scene(scene_id, {"status": "failed", "error_message": str(e)})

async def main_loop():
    print("Manhwa Studio Local Worker Started...")
    print("Waiting for pending scenes from Supabase...")
    while True:
        scenes = poll_pending_scenes()
        if scenes:
            for s in scenes:
                await process_scene(s)
        await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main_loop())
