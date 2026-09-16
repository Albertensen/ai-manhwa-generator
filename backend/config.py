import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Storage
STORAGE_DIR = BASE_DIR / "storage"
PANELS_DIR = STORAGE_DIR / "panels"
AUDIOS_DIR = STORAGE_DIR / "audios"
OUTPUTS_DIR = STORAGE_DIR / "outputs"
SUBTITLES_DIR = STORAGE_DIR / "subtitles"
MOTIONS_DIR = STORAGE_DIR / "motions"
RAW_DOWNLOADS_DIR = STORAGE_DIR / "raw_downloads"
PROJECT_CLIPS_DIR = STORAGE_DIR / "project_clips"
PROJECTS_DIR = STORAGE_DIR / "projects"
BROWSER_PROFILE_DIR = STORAGE_DIR / "browser_profile"

for d in [PANELS_DIR, AUDIOS_DIR, OUTPUTS_DIR, SUBTITLES_DIR, MOTIONS_DIR, RAW_DOWNLOADS_DIR, PROJECT_CLIPS_DIR, PROJECTS_DIR, BROWSER_PROFILE_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Supabase
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "https://yegyiqyqtcbvjjqxvyto.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZ3lpcXlxdGNidmpqcXh2eXRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExMjg4MiwiZXhwIjoyMTA0Njg4ODgyfQ.s5XlY4qjzXbjx4SfVqjdgyHP108Vtb_f9ucxtVtPK60")

# Google Flow (Nano Banana) Scraper Config
GOOGLE_FLOW_URL = os.getenv("GOOGLE_FLOW_URL", "https://labs.google/fx/tools/image-fx")
GOOGLE_FLOW_HEADLESS = os.getenv("GOOGLE_FLOW_HEADLESS", "false").lower() == "true"
GOOGLE_FLOW_TIMEOUT_SEC = int(os.getenv("GOOGLE_FLOW_TIMEOUT_SEC", "120"))

# ComfyUI (Local Fallback)
COMFYUI_HOST = os.getenv("COMFYUI_HOST", "http://127.0.0.1:8188")
COMFYUI_WS = os.getenv("COMFYUI_WS", "ws://127.0.0.1:8188/ws")
CHECKPOINT_NAME = "animagine-xl-3.1.safetensors"

# FFmpeg
FFMPEG_BIN = r"C:\Users\Administrator\prime-agent\ffmpeg_bin\ffmpeg.exe"
if not os.path.exists(FFMPEG_BIN):
    FFMPEG_BIN = "ffmpeg"

# TTS & Voice Engine
DEFAULT_VOICE_MALE = "id-ID-ArdiNeural"
DEFAULT_VOICE_FEMALE = "id-ID-GadisNeural"
DEFAULT_VOICE_ENGINE = os.getenv("VOICE_ENGINE", "edge_tts")
VOXCPM_MODEL_ID = "openbmb/VoxCPM2"
