import asyncio
import os
import subprocess
import edge_tts
try:
    from . import config
except (ImportError, ValueError):
    import config

async def synthesize_voice(text, output_file, voice=config.DEFAULT_VOICE_MALE, return_timestamps=False):
    """
    Generates high-quality speech with edge-tts.
    If return_timestamps is True, captures word-level boundaries directly from
    Edge-TTS stream (boundary='WordBoundary') with zero extra compute overhead.
    Returns:
        duration (float) if return_timestamps is False
        (duration, word_events) (tuple) if return_timestamps is True
    """
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
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
        # Parse Duration: 00:00:04.50
        for line in res.stderr.splitlines():
            if "Duration:" in line:
                part = line.split("Duration:")[1].split(",")[0].strip()
                h, m, s = part.split(":")
                return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception as e:
        print(f"Error calculating duration: {e}")
    return 4.0
