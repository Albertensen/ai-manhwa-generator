import os
import subprocess
from pathlib import Path

try:
    from . import config
except (ImportError, ValueError):
    import config

ASSETS_DIR = Path(__file__).resolve().parent / "assets"
SFX_DIR = ASSETS_DIR / "sfx"
BGM_DIR = ASSETS_DIR / "bgm"

BGM_PRESETS = {
    "epic_battle": str(BGM_DIR / "epic_battle.mp3"),
    "mystery_dungeon": str(BGM_DIR / "mystery_dungeon.mp3"),
    "melancholy_sad": str(BGM_DIR / "melancholy_sad.mp3")
}

SFX_PRESETS = {
    "whoosh": str(SFX_DIR / "whoosh.mp3"),
    "impact_boom": str(SFX_DIR / "impact_boom.mp3"),
    "sword_slash": str(SFX_DIR / "sword_slash.mp3")
}

def get_media_duration(file_path: str) -> float:
    """Calculates exact duration in seconds using ffprobe / ffmpeg"""
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
        print(f"[VideoComposer] Error calculating duration for {file_path}: {e}")
    return 4.0

def get_bgm_track(preset_or_path: str = "epic_battle") -> str:
    """Resolves BGM track from preset name or custom file path"""
    if preset_or_path in BGM_PRESETS and os.path.exists(BGM_PRESETS[preset_or_path]):
        return BGM_PRESETS[preset_or_path]
    if preset_or_path and os.path.exists(preset_or_path):
        return preset_or_path
    # Default fallback
    default_p = str(BGM_DIR / "epic_battle.mp3")
    if os.path.exists(default_p):
        return default_p
    return None

def create_scene_video(
    image_path: str,
    audio_path: str,
    duration: float,
    output_path: str,
    motion: str = 'zoom_in',
    subtitle_path: str = None,
    input_video_path: str = None
):
    """
    Composes a single scene video.
    If input_video_path (from motion_engine) is provided, uses True I2V clip.
    Otherwise falls back to Ken Burns 2D motion from image_path.
    If subtitle_path (.ass) is provided, burns dynamic captions via libass.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    fps = 30
    total_frames = int(duration * fps)

    sub_filter = ""
    sub_cwd = None
    if subtitle_path and os.path.exists(subtitle_path):
        sub_dir = os.path.abspath(os.path.dirname(subtitle_path))
        sub_file = os.path.basename(subtitle_path)
        sub_filter = f",ass={sub_file}"
        sub_cwd = sub_dir

    if input_video_path and os.path.exists(input_video_path):
        # Scale to 1080x1920, loop if shorter than duration, and burn subtitles
        vf = f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps={fps}{sub_filter}"
        if vf.startswith(","):
            vf = vf[1:]
        cmd = [
            config.FFMPEG_BIN,
            "-y",
            "-fflags", "+genpts",
            "-stream_loop", "-1",
            "-i", input_video_path,
            "-i", audio_path,
            "-vf", vf,
            "-c:v", "libx264",
            "-t", f"{duration:.2f}",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            output_path
        ]
    else:
        # Fallback 2D pan/zoom
        if motion == 'zoom_in':
            base_vf = f"zoompan=z='min(zoom+0.0015,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
        elif motion == 'zoom_out':
            base_vf = f"zoompan=z='if(lte(zoom,1.0),1.25,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
        elif motion == 'pan_left':
            base_vf = f"zoompan=z='1.15':x='if(lte(on,1),(iw-iw/zoom)/2,x-1.2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps={fps}"
        else:
            base_vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920"

        vf = f"{base_vf}{sub_filter}"
        cmd = [
            config.FFMPEG_BIN,
            "-y",
            "-loop", "1",
            "-i", image_path,
            "-i", audio_path,
            "-vf", vf,
            "-c:v", "libx264",
            "-t", f"{duration:.2f}",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            output_path
        ]

    res = subprocess.run(cmd, cwd=sub_cwd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg scene composition failed: {res.stderr[-500:]}")
    return output_path

def concat_scenes(
    scene_video_paths: list,
    final_output_path: str,
    bgm_preset: str = "epic_battle",
    bgm_volume: float = 0.18,
    scene_cues: list = None
):
    """
    Concatenates rendered scene videos, automatically triggers whoosh/impact/slash SFX
    at scene transition boundaries, and mixes background music (15-20% volume).
    """
    os.makedirs(os.path.dirname(final_output_path), exist_ok=True)
    if not scene_video_paths:
        raise ValueError("No scene videos to concatenate")

    # Step 1: Write concat list and create raw stitched video
    list_file = os.path.join(str(config.OUTPUTS_DIR), "concat_list.txt")
    scene_durations = []
    with open(list_file, "w", encoding="utf-8") as f:
        for p in scene_video_paths:
            escaped = os.path.abspath(p).replace("\\", "/")
            f.write(f"file '{escaped}'\n")
            dur = get_media_duration(p)
            scene_durations.append(dur)

    raw_stitched = os.path.join(str(config.OUTPUTS_DIR), "raw_stitched.mp4")
    cmd_concat = [
        config.FFMPEG_BIN,
        "-y",
        "-fflags", "+genpts",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        raw_stitched
    ]
    subprocess.check_call(cmd_concat)
    if os.path.exists(list_file):
        try:
            os.remove(list_file)
        except Exception:
            pass

    # Step 2: Calculate Transition Timings for SFX
    # Transition times in milliseconds
    sfx_inputs = []
    filter_chains = []
    
    whoosh_sfx = SFX_PRESETS.get("whoosh")
    impact_sfx = SFX_PRESETS.get("impact_boom")
    slash_sfx = SFX_PRESETS.get("sword_slash")

    current_time_ms = 0
    input_idx = 1 # 0 is raw_stitched

    for i in range(1, len(scene_durations)):
        current_time_ms += int(scene_durations[i-1] * 1000)
        # Whoosh at scene transition boundary (trigger 150ms before cut)
        whoosh_delay = max(0, current_time_ms - 150)
        if whoosh_sfx and os.path.exists(whoosh_sfx):
            sfx_inputs.extend(["-i", whoosh_sfx])
            filter_chains.append(f"[{input_idx}:a]adelay={whoosh_delay}|{whoosh_delay},volume=0.30[sfx_{input_idx}]")
            input_idx += 1

        # Check scene cues for action/sword impacts
        cue = (scene_cues[i] if scene_cues and i < len(scene_cues) else {}) or {}
        motion = cue.get("camera_motion", "")
        prompt = cue.get("visual_prompt", "").lower()
        if ("sword" in prompt or "blade" in prompt or "slash" in prompt) and slash_sfx and os.path.exists(slash_sfx):
            sfx_inputs.extend(["-i", slash_sfx])
            filter_chains.append(f"[{input_idx}:a]adelay={current_time_ms}|{current_time_ms},volume=0.35[sfx_{input_idx}]")
            input_idx += 1
        elif (motion in ("action", "zoom_in") or "impact" in prompt or "punch" in prompt) and impact_sfx and os.path.exists(impact_sfx):
            sfx_inputs.extend(["-i", impact_sfx])
            filter_chains.append(f"[{input_idx}:a]adelay={current_time_ms}|{current_time_ms},volume=0.38[sfx_{input_idx}]")
            input_idx += 1

    # Step 3: Add BGM
    target_bgm = get_bgm_track(bgm_preset)
    has_bgm = target_bgm and os.path.exists(target_bgm)
    if has_bgm:
        sfx_inputs.extend(["-stream_loop", "-1", "-i", target_bgm])
        filter_chains.append(f"[{input_idx}:a]volume={bgm_volume:.2f}[bgm_stream]")
        bgm_input_tag = "[bgm_stream]"
        input_idx += 1
    else:
        bgm_input_tag = ""

    # Step 4: Combine all audio streams
    # [0:a] is narration voice
    all_mix_tags = ["[0:a]"]
    for idx in range(1, input_idx - (1 if has_bgm else 0)):
        all_mix_tags.append(f"[sfx_{idx}]")
    if has_bgm:
        all_mix_tags.append(bgm_input_tag)

    total_inputs = len(all_mix_tags)
    filter_complex_str = ";".join(filter_chains)
    if filter_complex_str:
        filter_complex_str += ";"
    filter_complex_str += f"{''.join(all_mix_tags)}amix=inputs={total_inputs}:duration=first:dropout_transition=2[aout]"

    cmd_mix = [
        config.FFMPEG_BIN,
        "-y",
        "-fflags", "+genpts",
        "-i", raw_stitched,
        *sfx_inputs,
        "-filter_complex", filter_complex_str,
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        final_output_path
    ]

    print(f"[VideoComposer] Stitching {len(scene_video_paths)} scenes with {len(filter_chains)} SFX triggers & BGM '{bgm_preset}'...")
    res = subprocess.run(cmd_mix, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[VideoComposer] Advanced mix warning: {res.stderr[-400:]}. Falling back to clean copy...")
        if os.path.exists(final_output_path):
            os.remove(final_output_path)
        os.rename(raw_stitched, final_output_path)
    else:
        if os.path.exists(raw_stitched):
            try:
                os.remove(raw_stitched)
            except Exception:
                pass

    return final_output_path
