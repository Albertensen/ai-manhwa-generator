import os
import subprocess
try:
    from . import config
except (ImportError, ValueError):
    import config

def generate_default_bgm(output_path=None):
    """Generates an ambient dramatic background music tone if none provided"""
    if output_path is None:
        output_path = os.path.join(str(config.OUTPUTS_DIR), "default_bgm.mp3")
    
    if os.path.exists(output_path) and os.path.getsize(output_path) > 1000:
        return output_path

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    filter_expr = (
        "aevalsrc='0.12*sin(2*PI*65.41*t) + 0.10*sin(2*PI*77.78*t) + 0.10*sin(2*PI*98.00*t) + "
        "0.05*sin(2*PI*130.81*t + sin(2*PI*0.2*t))':s=44100:d=120,"
        "lowpass=f=800,afade=t=in:ss=0:d=3,afade=t=out:st=117:d=3"
    )
    cmd = [
        config.FFMPEG_BIN,
        "-y",
        "-f", "lavfi",
        "-i", filter_expr,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        output_path
    ]
    subprocess.check_call(cmd)
    return output_path

def create_scene_video(image_path, audio_path, duration, output_path, motion='zoom_in'):
    """Generates a single scene video with Ken Burns pan-and-zoom and synced audio"""
    fps = 30
    total_frames = int(duration * fps)
    
    if motion == 'zoom_in':
        vf = f"zoompan=z='min(zoom+0.0015,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    elif motion == 'zoom_out':
        vf = f"zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    elif motion == 'pan_left':
        vf = f"zoompan=z='1.15':x='if(lte(on,1),(iw-iw/zoom)/2,x-1.2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
    else:
        vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
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

def concat_scenes(scene_video_paths, final_output_path, bgm_path=None, bgm_volume=0.18):
    """Concatenates rendered scene videos and mixes background music (15-20% volume)"""
    os.makedirs(os.path.dirname(final_output_path), exist_ok=True)
    list_file = os.path.join(str(config.OUTPUTS_DIR), "concat_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in scene_video_paths:
            escaped = os.path.abspath(p).replace("\\", "/")
            f.write(f"file '{escaped}'\n")

    raw_stitched = os.path.join(str(config.OUTPUTS_DIR), "raw_stitched.mp4")

    # Step 1: Concat video parts
    cmd_concat = [
        config.FFMPEG_BIN,
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file,
        "-c", "copy",
        raw_stitched
    ]
    subprocess.check_call(cmd_concat)
    if os.path.exists(list_file):
        os.remove(list_file)

    # Step 2: Mix BGM if available
    target_bgm = bgm_path
    if not target_bgm or not os.path.exists(target_bgm):
        target_bgm = generate_default_bgm()

    if target_bgm and os.path.exists(target_bgm):
        filter_complex = f"[0:a]volume=1.0[voice];[1:a]volume={bgm_volume:.2f}[bgm];[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        cmd_mix = [
            config.FFMPEG_BIN,
            "-y",
            "-i", raw_stitched,
            "-stream_loop", "-1",
            "-i", target_bgm,
            "-filter_complex", filter_complex,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            final_output_path
        ]
        subprocess.check_call(cmd_mix)
        if os.path.exists(raw_stitched):
            try:
                os.remove(raw_stitched)
            except Exception:
                pass
    else:
        # Just rename raw_stitched
        if os.path.exists(final_output_path):
            os.remove(final_output_path)
        os.rename(raw_stitched, final_output_path)

    return final_output_path
