
import os
import sys
import asyncio

os.chdir(r"C:\Users\Administrator\Documents\MANHWA GENERATOR\backend")
sys.path.insert(0, r"C:\Users\Administrator\Documents\MANHWA GENERATOR\backend")

import comfy_client
import tts_engine
import video_composer

async def test_all():
    print("=== TESTING STEP 1: COMFYUI IMAGE GENERATION ===")
    prompt = "1boy, solo, masterpiece, best quality, male focus, black hair, sharp glowing blue eyes, dark trenchcoat, standing on a skyscraper rooftop overlooking seoul at night, neon lights, webtoon style, dynamic angle"
    negative = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, cropped, worst quality, low quality, normal quality, blurry"
    
    img_path = r"C:\Users\Administrator\Documents\MANHWA GENERATOR\output\test_panel.png"
    os.makedirs(os.path.dirname(img_path), exist_ok=True)
    comfy_client.generate_panel(prompt, negative, img_path)
    print(f"-> Image successfully generated: {img_path} ({os.path.getsize(img_path)} bytes)")

    print("\n=== TESTING STEP 2: EDGE-TTS NARRATION ===")
    narration_text = "Di malam yang dingin di kota Seoul, sang pemburu bangkit kembali dengan kekuatan baru yang tak terhentikan."
    audio_path = r"C:\Users\Administrator\Documents\MANHWA GENERATOR\output\test_audio.mp3"
    duration = await tts_engine.synthesize_voice(narration_text, audio_path)
    print(f"-> TTS audio generated: {audio_path} (Duration: {duration:.2f}s)")

    print("\n=== TESTING STEP 3: FFMPEG VIDEO ASSEMBLY (KEN BURNS) ===")
    video_path = r"C:\Users\Administrator\Documents\MANHWA GENERATOR\output\test_scene.mp4"
    res_path = video_composer.create_scene_video(
        image_path=img_path,
        audio_path=audio_path,
        duration=duration,
        output_path=video_path,
        motion="zoom_in"
    )
    print(f"-> Video scene successfully rendered: {res_path} (Size: {os.path.getsize(res_path)} bytes)")
    print("\n=== ALL PIPELINE STEPS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(test_all())
