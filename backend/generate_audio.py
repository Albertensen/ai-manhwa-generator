import os
import sys
import argparse
import asyncio
import json
import urllib.request
from pathlib import Path

# Configure Windows DLL search path for PyTorch & CTranslate2 (cublas64_12.dll)
torch_lib = Path(sys.prefix) / "Lib" / "site-packages" / "torch" / "lib"
if torch_lib.exists():
    try:
        os.add_dll_directory(str(torch_lib))
        os.environ["PATH"] = str(torch_lib) + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass

try:
    from . import config
    from . import tts_engine
    from . import storage_uploader
except (ImportError, ValueError):
    import config
    import tts_engine
    import storage_uploader

def supabase_headers():
    return {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

async def synthesize_single(
    text: str,
    output_file: str,
    engine: str = "voxcpm",
    emotion: str = "dramatic",
    reference_audio: str = None
):
    print(f"[AudioGen] Synthesizing speech using engine={engine} (emotion={emotion})...")
    print(f"  Text: {text}")
    
    dur, words = await tts_engine.synthesize_voice(
        text=text,
        output_file=output_file,
        return_timestamps=True,
        engine=engine,
        reference_audio=reference_audio,
        emotion=emotion
    )
    print(f"[AudioGen] Successfully generated ({dur:.2f}s, {len(words)} words) -> {output_file}")
    
    # Save word timestamps json alongside audio
    words_json_file = Path(output_file).with_suffix(".words.json")
    words_json_file.write_text(json.dumps(words, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[AudioGen] Word timestamps saved -> {words_json_file}")
    return dur, words

async def process_project_audio(
    project_id: str,
    engine: str = "voxcpm",
    emotion: str = "dramatic"
):
    headers = supabase_headers()
    print(f"[AudioGen] Fetching scenes for project {project_id} from Supabase REST API...")
    scenes_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_scenes?project_id=eq.{project_id}&order=scene_order.asc"
    req = urllib.request.Request(scenes_url, headers=headers)
    
    with urllib.request.urlopen(req) as res:
        scenes = json.loads(res.read())

    if not scenes:
        print(f"[AudioGen] No scenes found for project ID: {project_id}")
        return

    print(f"[AudioGen] Found {len(scenes)} scenes. Synthesizing voiceover with engine={engine}...")
    for s in scenes:
        scene_id = s.get("id")
        order = s.get("scene_order", 1)
        narration = s.get("narration_text") or ""
        if not narration.strip():
            continue

        print(f"\n--- Scene {order} (ID: {scene_id}) ---")
        audio_file = str(config.AUDIOS_DIR / f"{project_id}_scene_{order:03d}_{engine}.mp3")
        dur, words = await synthesize_single(
            text=narration,
            output_file=audio_file,
            engine=engine,
            emotion=emotion
        )

        # Upload audio to Supabase Storage
        remote_path = f"audios/{project_id}_scene_{order:03d}_{engine}.mp3"
        print(f"  Uploading audio to Supabase Storage ({remote_path})...")
        try:
            pub_url = storage_uploader.upload_file(audio_file, remote_path)
            
            # Update scene in Supabase
            update_url = f"{config.SUPABASE_URL}/rest/v1/manhwa_scenes?id=eq.{scene_id}"
            update_payload = json.dumps({
                "audio_url": pub_url,
                "duration_seconds": round(dur, 2)
            }).encode("utf-8")
            update_req = urllib.request.Request(update_url, data=update_payload, headers=headers, method="PATCH")
            with urllib.request.urlopen(update_req) as up_res:
                print(f"  Updated scene {order} with public audio URL: {pub_url}")
        except Exception as e:
            print(f"  Warning: Supabase upload/update failed: {e}")

def main():
    parser = argparse.ArgumentParser(description="AI Manhwa Generator Voiceover Synthesizer (Edge-TTS & VoxCPM2)")
    parser.add_argument("--text", type=str, help="Text to synthesize")
    parser.add_argument("--output", type=str, help="Output audio file (.mp3 / .wav)")
    parser.add_argument("--project-id", type=str, help="Supabase project ID to synthesize all scenes for")
    parser.add_argument("--engine", choices=["edge_tts", "voxcpm"], default="voxcpm", help="Voice engine (default: voxcpm)")
    parser.add_argument("--emotion", default="dramatic", choices=["dramatic", "intense", "calm", "whisper", "angry"], help="Emotion styling for VoxCPM")
    parser.add_argument("--ref-audio", type=str, default=None, help="Reference audio path for voice cloning")
    
    args = parser.parse_args()

    if args.project_id:
        asyncio.run(process_project_audio(args.project_id, engine=args.engine, emotion=args.emotion))
    elif args.text:
        out_f = args.output or str(config.AUDIOS_DIR / f"cli_synth_{args.engine}.mp3")
        asyncio.run(synthesize_single(args.text, out_f, engine=args.engine, emotion=args.emotion, reference_audio=args.ref_audio))
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
