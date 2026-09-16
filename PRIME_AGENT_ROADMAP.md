# Roadmap Perombakan Total: Autonomous AI Manhwa & Video Recap Studio

## Ringkasan Eksekutif & Tujuan Proyek

Proyek ini merombak repositori di `C:\Users\Administrator\Documents\MANHWA GENERATOR` menjadi **sistem studio AI komik dan video recap yang 100% diorkestrasi secara otonom oleh Prime Agent**. 

Pengguna bertindak sebagai **Showrunner / Penulis Kreatif** (hanya memasukkan ide cerita, tema, dan deskripsi karakter), sementara **Prime Agent** mengeksekusi seluruh rantai teknis produksi dari hulu ke hilir tanpa bergantung pada API pihak ketiga berbayar:
1. Membedah cerita menjadi naskah panel komik & prompt konsistensi karakter.
2. Mengotomasi pembuatan gambar secara langsung ke **Google Flow (Nano Banana)** via *browser automation* (Playwright) dan mengunduh gambar ke penyimpanan lokal.
3. Merakit komik digital berkualitas tinggi (tata letak panel, balon dialog, dan stiker SFX) menjadi berkas **PDF & Webtoon PNG**.
4. Memproduksi video animasi **Remotion 2.5D Motion Recap** (voiceover Edge-TTS bahasa Indonesia, subtitle kinetik karaoke presisi, pemisahan layer parallax RMBG 2.0, dan audio ducking) menjadi berkas **MP4 siap monetisasi di YouTube Shorts / TikTok**.

---

## Kondisi Codebase Saat Ini vs Kebutuhan Perombakan

| Komponen | Status Saat Ini di Repositori | Kebutuhan Perombakan Total |
| :--- | :--- | :--- |
| **Image Generation** | Menggunakan 9Router API (`127.0.0.1:20128/v1`) & ComfyUI | **Ganti total ke Google Flow (Nano Banana)** via Playwright headless/persistent browser scraper. |
| **Input Alur Kerja** | UI web semi-manual (pengguna harus klik tab 1, tab 2, tab 3, upload manual) | **Full Autonomous Orchestrator**: Satu skrip master yang bisa dipicu oleh Prime Agent dari ide cerita mentah. |
| **Comic Canvas** | Interaktif di browser (Konva React), hanya ekspor PNG 1 halaman | Tambahkan **Headless Comic Assembler** yang otomatis merakit panel, balon, & SFX, serta ekspor **Multi-Page PDF & Webtoon Strip**. |
| **Voice & Subtitle** | Edge-TTS ada di `tts_engine.py`, subtitle di `subtitle_generator.py` | Selaraskan integrasi `whisper` word-level timestamps langsung ke komposisi Remotion `KineticCaptions.tsx`. |
| **Video Motion Engine** | Remotion 4.0 (`@remotion/cli`) sudah terpasang | Aktifkan pipeline headless rendering otomatis via `backend/remotion_renderer.py` tanpa galat parameter UUID. |

---

## User Review Required

> [!IMPORTANT]
> **Sesi Login Google Flow:**
> Otomasi Google Flow (Nano Banana) membutuhkan sesi login akun Google aktif. Prime Agent akan menggunakan Playwright dengan direktori profil browser persisten (`storage/browser_profile`). Pengguna hanya perlu melakukan login akun Google satu kali pada jendela browser pertama yang terbuka, setelah itu sesi akan tersimpan permanen.

> [!NOTE]
> **Zero Paid API Cost:**
> Pipeline baru ini meniadakan seluruh dependensi API berbayar:
> - Gambar: Google Flow (Free tier / Web Interface via Scraper).
> - Suara: Edge-TTS (`id-ID-ArdiNeural` / `id-ID-GadisNeural`) - Gratis & bebas kuota.
> - Subtitle: Whisper lokal (`openai-whisper` / `faster-whisper`) - Berjalan di CPU/RTX 3060 Ti lokal.
> - Video Render: Remotion CLI lokal - Berjalan di RTX 3060 Ti lokal.

---

## Proposed Changes (Rencana Perombakan per Fase)

### Fase 1: Pembersihan Dependensi & Standarisasi Struktur Proyek
Menghilangkan dependensi 9Router berbayar, memperbaiki bug parameter UUID di API routes, dan merapikan struktur folder proyek.

#### [MODIFY] [config.py](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/backend/config.py)
- Hapus referensi 9Router.
- Tambahkan konfigurasi Google Flow scraper (direktori sesi browser `BROWSER_PROFILE_DIR`, URL Google Flow, timeout unduhan).
- Perbaiki resolusi FFmpeg binary dan direktori keluaran per proyek (`storage/projects/<project_id>/...`).

#### [MODIFY] [remotion/route.ts](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/src/app/api/render/remotion/route.ts)
- Dukung parameter fleksibel (`projectId` dan `project_id`).
- Hilangkan galat syntax UUID PostgreSQL.

---

### Fase 2: Mesin Scraping & Automasi Google Flow (Nano Banana)
Membangun modul automasi peramban untuk berinteraksi langsung dengan Google Flow tanpa API berbayar.

#### [NEW] [google_flow_scraper.py](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/backend/google_flow_scraper.py)
- Menggunakan Playwright dengan persistent context browser (`storage/browser_profile`).
- Fungsi `init_session()`: Membuka browser untuk login pertama kali jika belum ada sesi.
- Fungsi `generate_panel_batch(prompts_list, output_dir, aspect_ratio="9:16")`:
  - Memasukkan prompt ke antarmuka Google Flow.
  - Memilih model/rasio aspek Nano Banana / Manhwa style.
  - Menunggu proses render selesai secara reaktif.
  - Mengunduh berkas gambar asli beresolusi tinggi ke `storage/projects/<id>/raw_panels/`.

---

### Fase 3: Headless Comic Assembler (Perakitan Komik & PDF)
Membuat mesin perakitan halaman komik digital otomatis yang tidak mewajibkan pengguna menggeser kanvas satu per satu secara manual.

#### [NEW] [comic_assembler.py](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/backend/comic_assembler.py)
- Menggunakan Pillow / Canvas Engine untuk:
  - Menyusun gambar hasil Google Flow ke dalam tata letak komik (Webtoon 3-Panel, Action Slanted, Classic Manga 2x2).
  - Merender balon dialog (*speech bubbles*) oval / shout dengan ekor penunjuk yang diarahkan secara otomatis ke posisi karakter.
  - Menempelkan stiker efek suara tipografi (*onomatopoeia SFX*) seperti *SLASH!!*, *DUMMM!*, *CRASH!!* dengan sudut kemiringan dinamis.
  - Mengekspor **PDF komik lengkap (multi-halaman)** dan **PNG Webtoon strip bersambung**.

---

### Fase 4: Produksi Video Motion Recap 2.5D (Remotion Pipeline)
Menghubungkan suara vokal, subtitle presisi, pemisahan layer karakter, dan render video MP4.

#### [MODIFY] [remotion_renderer.py](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/backend/remotion_renderer.py)
- Mengotomasi pemisahan layer latar belakang vs subjek karakter menggunakan `layer_separator.py` (Bria RMBG 2.0).
- Menghasilkan audio narasi bahasa Indonesia menggunakan `tts_engine.py` (Edge-TTS).
- Mengekstraksi *word-level timestamps* menggunakan `whisper` agar teks karaoke emas di `KineticCaptions.tsx` sinkron sempurna dengan vokal.
- Memanggil Remotion CLI untuk merender video MP4 1080x1920 (9:16 vertikal @ 30fps) dengan BGM ducking.

---

### Fase 5: Prime Agent Autonomous Orchestrator (One-Click CLI)
Satu pintu gerbang kontrol di mana Prime Agent dapat mengeksekusi seluruh siklus produksi secara otonom.

#### [NEW] [prime_orchestrator.py](file:///C:/Users/Administrator/Documents/MANHWA%20GENERATOR/backend/prime_orchestrator.py)
- Menerima parameter naskah cerita dan karakter dari Prime Agent:
  `python backend/prime_orchestrator.py --title "Shadow Sovereign" --story "..." --character "Kaelen" --style "Solo Leveling"`
- Menjalankan pipeline otomatis:
  1. *Story & Prompt Breakdown* &rarr; `project.json`
  2. *Google Flow Batch Scraper* &rarr; `raw_panels/*.png`
  3. *Comic Assembler* &rarr; `comic_pages/*.png` & `comic_book.pdf`
  4. *TTS & Subtitle Alignment* &rarr; `audios/*.mp3` & `subtitles/*.json`
  5. *Layer Cutout (RMBG 2.0)* &rarr; `cutouts/*.png`
  6. *Remotion 2.5D Render* &rarr; `final_recap_video.mp4`
- Melaporkan kemajuan dan lokasi berkas final kepada Prime Agent.

---

## Verification Plan

### Automated Tests & Smoke Tests
1. **Verifikasi Browser Profile & Google Flow**:
   - Menjalankan skrip inisialisasi browser Playwright untuk memvalidasi login Google Flow.
2. **Verifikasi Comic Assembler**:
   - Menjalankan perakitan 1 halaman komik dengan gambar uji `test_kaelen_cloud_scene1.png` untuk memastikan balon teks dan SFX terpasang tajam dalam format PNG & PDF.
3. **Verifikasi Voiceover & Word Timestamp**:
   - Menguji sintesis vokal Edge-TTS bahasa Indonesia dan verifikasi ketersediaan array `wordTimestamps`.
4. **Verifikasi Remotion Video Rendering**:
   - Merender 1 klip video pendek 2.5D (4.5 detik) menggunakan Remotion CLI untuk memastikan tidak ada galat headless Chrome.

### Manual / User Verification
- Memeriksa berkas PDF komik yang dihasilkan.
- Menonton pratinjau video MP4 vertikal 9:16 untuk memastikan efek parallax 2.5D dan sinkronisasi subtitle karaoke sudah profesional dan siap diunggah ke YouTube Shorts.
