import os
import subprocess
from . import config

def create_scene_video(image_path, audio_path, duration, output_path, motion='zoom_in'):
    """Generates a single scene video with Ken Burns pan-and-zoom and synced audio"""
    # Calculate frames based on 30 fps
    fps = 30
    total_frames = int(duration * fps)
    
    if motion == 'zoom_in':
        vf = f"zoompan=z='min(zoom+0.0015,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    elif motion == 'zoom_out':
        vf = f"zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    elif motion == 'pan_left':
        vf = f"zoompan=z='1.15':x='if(lte(on,1),(iw-iw/zoom)/2,x-1.2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    else:
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"

    cmd = [
        config.FFMPEG_BIN,
        "-y",
        "-loop", "1",
        "-i", image_path,
        "-i", audio_path,
        "-vf", vf,
        "-c:v", "libx264",
        "-t", str(duration),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        output_path
    ]
    subprocess.check_call(cmd)
    return output_path

def concat_scenes(scene_video_paths, final_output_path):
    """Concatenates rendered scene videos into final episode MP4"""
    list_file = config.OUTPUTS_DIR / "concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in scene_video_paths:
            escaped = p.replace("\\", "/")
            f.write(f"file '{escaped}'\n")
            
    cmd = [
        config.FFMPEG_BIN,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        final_output_path
    ]
    subprocess.check_call(cmd)
    if os.path.exists(list_file):
        os.remove(list_file)
    return final_output_path
