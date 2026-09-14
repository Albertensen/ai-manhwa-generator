import asyncio
import os
import subprocess
import edge_tts
from . import config

async def synthesize_voice(text, output_file, voice=config.DEFAULT_VOICE_MALE):
    """Generates high-quality speech with edge-tts"""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)
    
    # Calculate audio duration using ffprobe / ffmpeg
    duration = get_audio_duration(output_file)
    return duration

def get_audio_duration(file_path):
    """Calculates exact audio duration in seconds"""
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
