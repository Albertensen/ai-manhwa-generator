import asyncio
import os
import subprocess
import edge_tts
try:
    from . import config
except (ImportError, ValueError):
    import config

async def synthesize_voice(
    text,
    output_file,
    voice=config.DEFAULT_VOICE_MALE,
    return_timestamps=False,
    engine="edge_tts",
    reference_audio=None,
    emotion="dramatic"
):
    """
    Generates high-quality speech.
    Supports two engines:
      - 'edge_tts': Fast, cloud-based Edge-TTS (id-ID-ArdiNeural) with native WordBoundary events.
      - 'voxcpm': High-Emotion 48kHz VoxCPM2 Neural Actor with faster-whisper alignment and auto-fallback.
    
    Returns:
        duration (float) if return_timestamps is False
        (duration, word_events) (tuple) if return_timestamps is True
    """
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    if engine == "voxcpm":
        try:
            try:
                from . import voxcpm_client
            except (ImportError, ValueError):
                import voxcpm_client
            
            res = voxcpm_client.synthesize_speech(
                text=text,
                output_file=output_file,
                reference_audio_path=reference_audio,
                emotion=emotion,
                return_timestamps=return_timestamps
            )
            return res
        except Exception as e:
            print(f"[tts_engine] VoxCPM execution error ({e}). Falling back to Edge-TTS...")

    # Edge-TTS pipeline
    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")
    word_events = []
    with open(output_file, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offset and duration are in 100ns units (ticks)
                start_sec = chunk["offset"] / 10_000_000.0
                dur_sec = chunk["duration"] / 10_000_000.0
                word_events.append({
                    "text": chunk["text"],
                    "start": start_sec,
                    "duration": dur_sec,
                    "end": start_sec + dur_sec
                })
    
    duration = get_audio_duration(output_file)
    if return_timestamps:
        return duration, word_events
    return duration

def get_audio_duration(file_path):
    """Calculates exact audio duration in seconds using ffprobe / ffmpeg"""
    try:
        cmd = [
            config.FFMPEG_BIN,
            "-i", file_path,
            "-f", "null", "-"
        ]
        res = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
        for line in res.stderr.splitlines():
            if "Duration:" in line:
                part = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = part.split(":")
                return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception as e:
        print(f"Error calculating duration: {e}")
    return 4.0
