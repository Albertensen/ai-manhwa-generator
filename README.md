# AI Manhwa Studio & Recap Generator

Fullstack automated system for creating AI Manhwa / Anime Recap storytelling videos with persistent character visual locking across scenes.

## Architecture
- **Frontend & Orchestrator**: Next.js 16 (App Router), Tailwind CSS v4, Lucide Icons.
- **Cloud Database**: Supabase with isolated `manhwa_*` schema (`manhwa_projects`, `manhwa_characters`, `manhwa_scenes`, `manhwa_video_jobs`).
- **AI Storyboard & Character Consistency Engine**: 9Router LLM with automated prompt injection for locked character physical attributes.
- **Local Media Worker (RTX 3060 Ti)**:
  - ComfyUI API Client (SDXL / Animagine XL 3.1)
  - edge-tts (High-definition Indonesian narration)
  - FFmpeg (Ken Burns dynamic pan-and-zoom motion compositing)

## Getting Started

### 1. Web Studio (Cloud / Local)
```bash
npm install
npm run dev
```

### 2. Local Worker
```bash
python backend/worker.py
```
