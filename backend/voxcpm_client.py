import os
import sys
import time
import asyncio
import subprocess
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
except (ImportError, ValueError):
    import config
    import tts_engine

# Global Singletons
_voxcpm_model = None
_whisper_model = None

# Emotion styling prompts for VoxCPM Voice Design / Context Conditioning
EMOTION_PROMPTS = {
    "dramatic": "(A deep, authoritative, dramatic voice with intense cinematic gravitas and suspenseful pacing) ",
    "intense": "(An intense, powerful, heroic male voice, high tension and energetic pace) ",
    "calm": "(A calm, measured, mysterious narrator with quiet resonance and deliberate pauses) ",
    "whisper": "(A dark, chilling, whispered sinister tone with ominous echoes) ",
    "angry": "(An aggressive, furious warrior voice with fierce battle resonance) ",
}

def check_vram_available(min_free_gb: float = 4.5) -> bool:
    """Checks whether the GPU has enough free VRAM for VoxCPM2 inference"""
    try:
        import torch
        if not torch.cuda.is_available():
            return False
        total = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        allocated = torch.cuda.memory_allocated(0) / (1024**3)
        reserved = torch.cuda.memory_reserved(0) / (1024**3)
        free = total - max(allocated, reserved)
        return free >= min_free_gb
    except Exception:
        return False

def get_vram_stats() -> dict:
    """Returns GPU VRAM status metrics"""
    try:
        import torch
        if not torch.cuda.is_available():
            return {"cuda_available": False, "device": "CPU", "free_gb": 0.0, "total_gb": 0.0}
        total = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        allocated = torch.cuda.memory_allocated(0) / (1024**3)
        reserved = torch.cuda.memory_reserved(0) / (1024**3)
        free = total - max(allocated, reserved)
        return {
            "cuda_available": True,
            "device": torch.cuda.get_device_name(0),
            "free_gb": round(free, 2),
            "allocated_gb": round(allocated, 2),
            "reserved_gb": round(reserved, 2),
            "total_gb": round(total, 2)
        }
    except Exception:
        return {"cuda_available": False, "device": "unknown", "free_gb": 0.0, "total_gb": 0.0}

def get_voxcpm_model():
    """Lazy loader for VoxCPM2 model singleton"""
    global _voxcpm_model
    if _voxcpm_model is None:
        import torch
        from voxcpm import VoxCPM
        print("[VoxCPM] Initializing VoxCPM2 model from cache (load_denoiser=False)...")
        start_t = time.time()
        _voxcpm_model = VoxCPM.from_pretrained(
            "openbmb/VoxCPM2",
            load_denoiser=False
        )
        print(f"[VoxCPM] Model loaded in {time.time() - start_t:.2f}s on {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    return _voxcpm_model

def get_whisper_model():
    """Lazy loader for faster-whisper alignment model singleton"""
    global _whisper_model
    if _whisper_model is None:
        import torch
        from faster_whisper import WhisperModel
        device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if torch.cuda.is_available() else "int8"
        print(f"[VoxCPM] Initializing faster-whisper 'base' model on {device} ({compute_type})...")
        _whisper_model = WhisperModel("base", device=device, compute_type=compute_type)
    return _whisper_model

def extract_word_timestamps(audio_file: str, language: str = "id") -> list:
    """
    Extracts word-level timestamps (text, start, end, duration) using faster-whisper
    to match KineticCaptions.tsx subtitle format.
    """
    try:
        model = get_whisper_model()
        segments, _ = model.transcribe(str(audio_file), word_timestamps=True, language=language)
        words = []
        for segment in segments:
            for w in segment.words:
                cleaned = w.word.strip()
                if cleaned:
                    words.append({
                        "text": cleaned,
                        "start": round(float(w.start), 2),
                        "end": round(float(w.end), 2),
                        "duration": round(float(w.end - w.start), 2)
                    })
        return words
    except Exception as e:
        print(f"[VoxCPM] Warning: Whisper word timestamp alignment failed ({e}). Fallback to rough timing.")
        return []

def synthesize_speech(
    text: str,
    output_file: str = None,
    reference_audio_path: str = None,
    emotion: str = "dramatic",
    return_timestamps: bool = True,
    cfg_value: float = 2.0,
    inference_timesteps: int = 10
):
    """
    Synthesizes expressive voiceover using VoxCPM2 Neural Actor with automated
    fallback to Edge-TTS (`id-ID-ArdiNeural`) if GPU/checkpoint is unavailable.
    
    Args:
        text (str): Indonesian or multilingual text to synthesize.
        output_file (str, optional): Target output path (.wav or .mp3).
        reference_audio_path (str, optional): Reference audio for timbre voice cloning.
        emotion (str): Emotion tone ('dramatic', 'intense', 'calm', 'whisper', 'angry').
        return_timestamps (bool): If True, returns (duration, word_timestamps).
        cfg_value (float): Guidance scale (default: 2.0).
        inference_timesteps (int): Generation steps (default: 10).
    
    Returns:
        float if return_timestamps is False
        tuple (float, list[dict]) if return_timestamps is True
    """
    if not output_file:
        timestamp = int(time.time() * 1000)
        output_file = str(config.AUDIOS_DIR / f"voxcpm_{timestamp}.mp3")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    out_p = Path(output_file)

    # 1. Pre-flight Check: VRAM & GPU availability
    if not check_vram_available(min_free_gb=4.5):
        stats = get_vram_stats()
        print(f"[VoxCPM] VRAM insufficient ({stats.get('free_gb', 0)}GB free < 4.5GB). Falling back to Edge-TTS.")
        return _fallback_edge_tts(text, output_file, return_timestamps)

    # 2. Attempt VoxCPM2 Synthesis
    try:
        import soundfile as sf
        model = get_voxcpm_model()

        # Format emotion guidance prefix
        emotion_prefix = EMOTION_PROMPTS.get(emotion.lower(), EMOTION_PROMPTS["dramatic"])
        target_prompt = f"{emotion_prefix}{text.strip()}"

        print(f"[VoxCPM] Synthesizing speech [emotion={emotion}, clone={'Yes' if reference_audio_path else 'No'}]...")
        start_t = time.time()
        wav = model.generate(
            text=target_prompt,
            reference_wav_path=reference_audio_path if (reference_audio_path and os.path.exists(reference_audio_path)) else None,
            cfg_value=cfg_value,
            inference_timesteps=inference_timesteps
        )
        elapsed = time.time() - start_t
        print(f"[VoxCPM] Speech generated in {elapsed:.2f}s!")

        sample_rate = getattr(model.tts_model, "sample_rate", 48000)

        # Write audio output
        if out_p.suffix.lower() == ".wav":
            sf.write(str(out_p), wav, sample_rate)
        else:
            # Save temporary wav and convert to mp3 via ffmpeg for optimal size/compatibility
            temp_wav = out_p.with_suffix(".temp.wav")
            sf.write(str(temp_wav), wav, sample_rate)
            try:
                cmd = [
                    config.FFMPEG_BIN,
                    "-y",
                    "-i", str(temp_wav),
                    "-codec:a", "libmp3lame",
                    "-qscale:a", "2",
                    str(out_p)
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            finally:
                if temp_wav.exists():
                    temp_wav.unlink()

        # 3. Calculate exact duration
        duration = tts_engine.get_audio_duration(str(out_p))

        # 4. Extract word timestamps using faster-whisper
        word_events = []
        if return_timestamps:
            word_events = extract_word_timestamps(str(out_p), language="id")

        if return_timestamps:
            return duration, word_events
        return duration

    except Exception as e:
        print(f"[VoxCPM] Generation error encountered: {e}. Executing automatic fallback to Edge-TTS...")
        return _fallback_edge_tts(text, output_file, return_timestamps)

def _fallback_edge_tts(text: str, output_file: str, return_timestamps: bool):
    """Executes graceful fallback using Edge-TTS (id-ID-ArdiNeural)"""
    print("[VoxCPM Fallback] Running Edge-TTS (id-ID-ArdiNeural)...")
    try:
        # Run async synthesize_voice synchronously
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                tts_engine.synthesize_voice(
                    text,
                    output_file,
                    voice=config.DEFAULT_VOICE_MALE,
                    return_timestamps=return_timestamps
                )
            )
            return result
        finally:
            loop.close()
    except Exception as e:
        print(f"[VoxCPM Fallback Error] Edge-TTS also encountered error: {e}")
        if return_timestamps:
            return 4.0, []
        return 4.0

if __name__ == "__main__":
    print("=== VoxCPM Client & Fallback Test ===")
    vram = get_vram_stats()
    print("GPU VRAM Stats:", vram)
    
    test_text = "Di tengah reruntuhan labirin kuno, Kaelen merasakan aura hitam yang bangkit."
    test_out = str(config.AUDIOS_DIR / "voxcpm_cli_test.mp3")
    
    dur, words = synthesize_speech(test_text, test_out, emotion="dramatic", return_timestamps=True)
    print(f"Generated {dur:.2f}s audio at: {test_out}")
    print(f"Extracted {len(words)} word timestamps:")
    for w in words[:5]:
        print(" ", w)
