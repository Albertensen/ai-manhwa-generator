# AI Manhwa & Anime Recap Generator - Complete System & Automation Specs

Dokumen ini berisi seluruh konfigurasi, API keys, endpoint, arsitektur pipeline, struktur database, serta panduan otomasi end-to-end untuk melanjutkan proyek.

---

## 1. Lokasi Workspace & Repositori

- **Workspace Lokal**: `C:\Users\Administrator\Documents\MANHWA GENERATOR`
- **Git Repository**: `https://github.com/Albertensen/ai-manhwa-generator.git` (Branch: `main`)
- **Live Production App (Vercel)**: `https://ai-manhwa-generator.vercel.app`
- **Local ComfyUI SSD Path**: `C:\ComfyUI`
- **FFmpeg Binary**: `C:\Users\Administrator\prime-agent\ffmpeg_bin\ffmpeg.exe`
- **Git Bash Executable**: `C:\Users\Administrator\AppData\Local\hermes\git\bin\bash.exe`

---

## 2. API Keys & Credentials (.env.local)

File konfigurasi ada di: `C:\Users\Administrator\Documents\MANHWA GENERATOR\.env.local`

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://yegyiqyqtcbvjjqxvyto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZ3lpcXlxdGNidmpqcXh2eXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTI4ODIsImV4cCI6MjEwNDY4ODg4Mn0.kY78L83-pY596n68c4n7F1hO_M_oU5uH33eX4t4fT_Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZ3lpcXlxdGNidmpqcXh2eXRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExMjg4MiwiZXhwIjoyMTA0Njg4ODgyfQ.s5XlY4qjzXbjx4SfVqjdgyHP108Vtb_f9ucxtVtPK60

# 9Router AI Engine
ROUTER_BASE_URL=http://127.0.0.1:20128/v1
ROUTER_API_KEY=sk-f6d23bb7bbd0260e-v9p3lm-e4eadc94
ROUTER_MODEL=COMBO-GEMINI

# Local ComfyUI (Fallback / Offline)
COMFYUI_HOST=http://127.0.0.1:8188
```

*Catatan Keamanan Supabase*:
- Project ID Supabase: `yegyiqyqtcbvjjqxvyto`
- Bucket Storage Publik: `manhwa-assets`
- Seluruh tabel database proyek ini menggunakan prefiks `manhwa_` agar terisolasi 100% dari tabel proyek lain (`WEB MUA`).
  - `manhwa_projects`
  - `manhwa_characters`
  - `manhwa_scenes`
  - `manhwa_video_jobs`

---

## 3. Arsitektur Pipeline Otomatisasi (2-Step High Quality Workflow)

### Tahap 1: Storyboard & Scripting (LLM)
- **Engine**: 9Router `/chat/completions` (`COMBO-GEMINI` / `ag/gemini-3.8-flash`)
- **System Prompt**: Storyboard Director ala manhwa Solo Leveling.
- **Output Schema**: JSON terstruktur (`project_title`, `synopsis`, `scenes` array berisi narasi bahasa Indonesia, durasi, camera motion, `visual_prompt`, `negative_prompt`).
- **Prompt Style**:
  `"high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, dramatic rim lighting, unreal engine 5 render, highly detailed, 8k wallpaper, [Locked Character Appearance], [Scene Action]"`
- **Strict Negative Prompt**:
  `"ugly, low quality, deformed anatomy, blurry, artifacts, lowres, distorted face, mutated hands, extra fingers, text, speech bubble, watermark"`

### Tahap 2: Voiceover Synthesis (TTS)
- **Engine**: Edge-TTS (`tts_engine.py`)
- **Voice Male**: `id-ID-ArdiNeural` (default untuk narator dramatis)
- **Voice Female**: `id-ID-GadisNeural`
- **Output**: `storage/audios/scene_{id}.mp3` -> Diunggah otomatis ke `manhwa-assets/audios/`

### Tahap 3: 2-Step Character Consistency & Image Generation
- **Primary Engine**: 9Router Cloud Image API (`ag/gemini-3.1-flash-image`) via `backend/cloud_image_client.py`
- **Rasio**: Vertical 9:16 (`1024x1792` -> `768x1376` -> upscaled ke `1080x1920`)
- **Kecepatan**: ~10–13 detik per gambar (0% beban GPU lokal)
- **Alur 2-Step Consistency**:
  1. **Step 1 (Anchor Master)**: Menghasilkan 1 gambar Master Character Sheet portrait & upper-body (`characters/{char_id}_master.png`) dan menyimpannya di kolom `manhwa_characters.reference_image_url`.
  2. **Step 2 (Scene Conditioning)**: Setiap adegan menyertakan referensi visual master image tersebut dalam payload multimodal `image: "data:image/jpeg;base64,..."` sehingga bentuk wajah, rambut, mata, dan pakaian 100% konsisten antar adegan.
- **Fallback Engine**:
  - Cloud Fallback: Pollinations FLUX cloud
  - Local Fallback: ComfyUI (Animagine SDXL + IP-Adapter Plus pada GPU RTX 3060 Ti lokal via Scheduled Task `ComfyUIServer`)

### Tahap 4: Motion Video & Dynamic Compositing (FFmpeg)
- **Ken Burns Effect**:
  - `zoom_in`: Zoom halus dari 1.0x ke 1.15x
  - `zoom_out`: Zoom halus dari 1.15x ke 1.0x
  - `pan_left`: Geser dinamis ke kiri
- **Output Adegan**: Video vertikal 1080x1920 30fps H.264 AAC.
- **Final Stitching & BGM**:
  - Menggabungkan seluruh adegan video secara berurutan.
  - Looping ambient background music (`default_bgm.mp3`) dimixing dengan filter FFmpeg `amix`: BGM volume `0.18` (18%), suara narasi `1.0` (100%).
  - Diunggah ke Supabase Storage: `videos/{project_id}.mp4` dan status project diperbarui menjadi `completed`.

---

## 4. Cara Menjalankan Pipeline & Worker

### Opsi A: Melalui Web Studio Frontend
1. Buka [https://ai-manhwa-generator.vercel.app](https://ai-manhwa-generator.vercel.app)
2. Masukkan ide cerita, nama karakter, dan deskripsi penampilan yang ingin dikunci.
3. Klik "Generate Storyboard" -> data otomatis tersimpan di database Supabase.
4. Jalankan worker backend di lokal untuk merender seluruh episode.

### Opsi B: Menjalankan Background Worker Otomatis
Buka terminal / command prompt:
```bash
cd "C:\Users\Administrator\Documents\MANHWA GENERATOR"
C:\ComfyUI\.venv\Scripts\python.exe backend/worker.py
```
Worker akan otomatis:
1. Memeriksa antrian tabel `manhwa_scenes` yang berstatus `pending`.
2. Menghasilkan voiceover Edge-TTS.
3. Mengunci karakter dengan Master Anchor Sheet.
4. Merender gambar manhwa berkualitas tinggi via cloud multimodal.
5. Menyusun klip Ken Burns.
6. Menyatukan episode final dengan BGM dan mengunggahnya ke CDN.

### Opsi C: Menjalankan Quality Test / Smoke Test 1 Adegan
```bash
cd "C:\Users\Administrator\Documents\MANHWA GENERATOR"
C:\ComfyUI\.venv\Scripts\python.exe backend/test_quality_upgrade.py
```

---

## 5. Ringkasan Asset Hasil Uji Coba

- **Master Character Sheet (Kaelen)**:
  `https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/characters/kaelen_anchor_master.png`
- **Upgraded Scene 1 Panel**:
  `https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/panels/kaelen_scene1_upgraded.png`
- **Upgraded Scene 1 Video**:
  `https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/videos/kaelen_scene1_upgraded.mp4`
- **Full 3-Scene Episode (Smoke Test)**:
  `https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/videos/4cdf9913-9e6f-472a-ad20-fb263f558e66.mp4`
