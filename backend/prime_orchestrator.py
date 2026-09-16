"""
Prime Agent Master Autonomous Orchestrator
Orchestrates the entire AI Manhwa & Video Recap pipeline:
  Story Input -> Google Flow (Nano Banana) -> Comic Pages & PDF -> Audio/Subtitles -> 2.5D Motion Video
Zero-cost, local GPU-accelerated, autonomous end-to-end production.
"""

import os
import sys
import time
import json
import asyncio
import argparse
from pathlib import Path
from typing import Dict, List, Optional

if sys.platform == 'win32':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Setup backend paths
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from backend import config
from backend.comic_assembler import ComicAssembler
from backend.google_flow_scraper import GoogleFlowScraper
from backend import tts_engine
from backend import remotion_renderer

# Try layer separator
try:
    from backend.layer_separator import process_panel_layers
except ImportError:
    process_panel_layers = None

def adapt_web_script_to_storyboard(data: Dict, project_id: Optional[str] = None) -> Dict:
    proj_id = project_id or data.get("id") or f"proj_{int(time.time())}"
    title = data.get("title") or "Manhwa Story"
    synopsis = data.get("synopsis") or ""
    genre = data.get("genre") or "Action Fantasy"
    characters = data.get("characters", [])
    
    adapted_pages = []
    all_scenes = []
    scene_counter = 1

    for page in data.get("pages", []):
        page_num = page.get("pageNumber") or page.get("page_number") or 1
        layout = page.get("layout", "webtoon")
        raw_panels = page.get("panels", [])
        page_panels = []

        for pnl in raw_panels:
            v_prompt = pnl.get("visualPrompt") or pnl.get("visual_prompt") or "cinematic manhwa scene"
            dialogue = pnl.get("dialogue") or ""
            speaker = pnl.get("speaker") or "Narrator"
            sfx = pnl.get("sfxPrompt") or pnl.get("sfx")

            scene_item = {
                "scene_order": scene_counter,
                "speaker": speaker,
                "dialogue": dialogue,
                "narration": f"{speaker}: {dialogue}" if dialogue else f"Adegan {scene_counter}: {v_prompt[:80]}",
                "visual_prompt": v_prompt,
                "camera_motion": "zoom_in" if scene_counter % 2 == 1 else "pan_right",
                "bubble_type": "shout" if sfx else "oval",
                "sfx": sfx
            }
            page_panels.append(scene_item)
            all_scenes.append(scene_item)
            scene_counter += 1

        adapted_pages.append({
            "page_number": page_num,
            "layout": layout,
            "panels": page_panels,
            "bubbles": page.get("bubbles", []),
            "sfx_stickers": page.get("sfxStickers", [])
        })

    if not all_scenes:
        return generate_default_storyboard(title, synopsis, project_id=proj_id)

    return {
        "project_id": proj_id,
        "title": title,
        "story": synopsis,
        "genre": genre,
        "characters": characters,
        "pages": adapted_pages,
        "scenes": all_scenes
    }

def generate_default_storyboard(
    title: str,
    story: str,
    character_name: str = "Kaelen",
    character_prompt: str = "1man, solo, messy black hair, piercing glowing electric blue eyes, black trench coat, athletic build",
    genre: str = "Solo Leveling / Dark Fantasy",
    num_panels: int = 3,
    project_id: Optional[str] = None
) -> Dict:
    """
    Parses/constructs structured storyboard JSON from user story idea.
    """
    if not project_id:
        project_id = f"proj_{int(time.time())}"
    
    # Base manhwa prompt prefix
    style_prefix = "high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, dramatic rim lighting, 8k masterpiece"

    # Default 3 scenes template if 3 panels requested
    scenes = [
        {
            "scene_order": 1,
            "speaker": character_name,
            "dialogue": f"Di kedalaman dungeon kuno ini... aku bersumpah tidak akan mati sia-sia.",
            "narration": f"{character_name} terperangkap di ruang terdalam dungeon S-Rank, menolak tunduk pada kematian.",
            "visual_prompt": f"{style_prefix}, {character_prompt}, standing wounded amidst crumbling ancient dungeon ruins, dark stone altar, eerie glowing blue dust particles, low angle shot, cinematic rim lighting",
            "camera_motion": "zoom_in",
            "bubble_type": "oval",
            "sfx": None
        },
        {
            "scene_order": 2,
            "speaker": character_name,
            "dialogue": "Aura bayangan raja kuno... mengalir deras di dalam darahku!",
            "narration": "Tetesan darahnya membangkitkan belati kuno yang tertancap di altar. Aura ungu pekat menyembur dahsyat!",
            "visual_prompt": f"{style_prefix}, {character_prompt}, dark purple shadow mist swirling violently around hands, glowing dagger in hand, intense fierce expression, dynamic action combat pose, high contrast",
            "camera_motion": "pan_left",
            "bubble_type": "shout",
            "sfx": "CRASH!!"
        },
        {
            "scene_order": 3,
            "speaker": character_name,
            "dialogue": "BANGKITLAH, PASUKAN BAYANGAN!!",
            "narration": "Dengan teriakan membelah keheningan dungeon, tentara bayangan bangkit menuruti titah rajanya.",
            "visual_prompt": f"{style_prefix}, {character_prompt}, army of shadowy glowing soldiers rising behind him, eyes ablaze with electric blue fire, majestic dark sovereign stance, 8k wallpaper",
            "camera_motion": "zoom_out",
            "bubble_type": "shout",
            "sfx": "DUMMM!"
        }
    ]

    return {
        "project_id": project_id,
        "title": title,
        "story": story,
        "genre": genre,
        "character": {
            "name": character_name,
            "prompt": character_prompt
        },
        "pages": [
            {
                "page_number": 1,
                "layout": "webtoon",
                "panels": scenes
            }
        ],
        "scenes": scenes
    }

class PrimeOrchestrator:
    def __init__(self, project_dir: Optional[Path] = None):
        self.project_dir = project_dir

    def run_full_pipeline(
        self,
        story_data: Dict,
        skip_scraper: bool = False,
        bgm_preset: str = "epic_battle"
    ) -> Dict:
        """
        Executes end-to-end production:
        1. Setup project storage
        2. Image generation (Google Flow / Nano Banana)
        3. Comic assembly (PNG & PDF)
        4. Audio & Word-level subtitle generation
        5. Layer cutout (RMBG 2.0)
        6. Remotion 2.5D video rendering
        """
        t_start = time.time()
        project_id = story_data["project_id"]
        proj_root = config.PROJECTS_DIR / project_id
        
        panels_dir = proj_root / "raw_panels"
        comic_dir = proj_root / "comic_pages"
        audios_dir = proj_root / "audios"
        cutouts_dir = proj_root / "cutouts"
        
        for d in [panels_dir, comic_dir, audios_dir, cutouts_dir]:
            d.mkdir(parents=True, exist_ok=True)

        print("\n=======================================================")
        print(f"  PRIME AGENT ORCHESTRATOR: {story_data['title'].upper()}")
        print(f"  Project ID: {project_id}")
        print("=======================================================\n")

        # Save story metadata
        with open(proj_root / "story_script.json", "w", encoding="utf-8") as f:
            json.dump(story_data, f, indent=2, ensure_ascii=False)

        scenes = story_data["scenes"]
        sample_fallback = BASE_DIR / "test_kaelen_cloud_scene1.png"

        # --- STEP 1: Image Generation (Google Flow) ---
        print("[Step 1/5] Generating panel images via Google Flow (Nano Banana)...")
        panel_paths = []
        if not skip_scraper:
            scraper = GoogleFlowScraper()
            try:
                panel_paths = scraper.generate_batch(scenes, str(panels_dir))
            except Exception as e:
                print(f"[PrimeOrchestrator] Google Flow scraper notice: {e}")
        
        # Fallback check
        for idx, sc in enumerate(scenes):
            expected = panels_dir / f"panel_{idx + 1}.png"
            if not expected.exists():
                if sample_fallback.exists():
                    import shutil
                    shutil.copy2(sample_fallback, expected)
                    print(f"[PrimeOrchestrator] Using sample panel for Scene {idx + 1}: {expected.name}")
            panel_paths.append(str(expected))
            sc["image_path"] = str(expected)

        # --- STEP 2: Assemble Digital Comic & PDF ---
        print("\n[Step 2/5] Assembling comic pages and exporting PDF/PNG...")
        assembler = ComicAssembler()
        assembled_pages = []
        
        for page_idx, page in enumerate(story_data["pages"]):
            page_panels = page["panels"]
            for i, p in enumerate(page_panels):
                if i < len(panel_paths):
                    p["image_path"] = panel_paths[i]

            out_page_png = str(comic_dir / f"page_{page['page_number']}.png")
            assembler.assemble_page(page, out_page_png)
            assembled_pages.append(out_page_png)

        # Export PDF book
        pdf_path = str(proj_root / f"{project_id}_comic_book.pdf")
        assembler.export_pdf(assembled_pages, pdf_path)

        # Export Webtoon Strip
        webtoon_strip_path = str(proj_root / f"{project_id}_webtoon_strip.png")
        assembler.export_webtoon_strip(assembled_pages, webtoon_strip_path)

        # --- STEP 3: Voiceover & Subtitles (Edge-TTS) ---
        print("\n[Step 3/5] Synthesizing Indonesian narration with word-level subtitles...")
        for idx, sc in enumerate(scenes):
            audio_out = str(audios_dir / f"scene_{idx + 1}.mp3")
            narration_text = sc.get("narration") or sc.get("dialogue") or "Adegan baru..."
            
            # Synthesize with timestamps
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                dur, words = loop.run_until_complete(
                    tts_engine.synthesize_voice(
                        narration_text,
                        audio_out,
                        return_timestamps=True
                    )
                )
                sc["audio_path"] = audio_out
                sc["duration_seconds"] = dur
                sc["word_timestamps"] = words
                print(f"  - Scene {idx + 1}: {dur:.1f}s audio, {len(words)} word timestamps")
            finally:
                loop.close()

        # --- STEP 4: Layer Cutout for 2.5D Parallax ---
        print("\n[Step 4/5] Separating character foregrounds for 2.5D Parallax...")
        for idx, sc in enumerate(scenes):
            bg_path = sc.get("image_path")
            sc["backgroundUrl"] = bg_path
            sc["foregroundUrl"] = None

            if process_panel_layers and bg_path and os.path.exists(bg_path):
                try:
                    layers = process_panel_layers(bg_path)
                    if layers.get("foreground_local") and os.path.exists(layers["foreground_local"]):
                        sc["foregroundUrl"] = layers["foreground_local"]
                        print(f"  - Scene {idx + 1}: Cutout generated successfully.")
                except Exception as e:
                    print(f"  - Scene {idx + 1}: Cutout skipped ({e})")

        # --- STEP 5: Render 2.5D Video Recap (Remotion) ---
        print("\n[Step 5/5] Rendering final 2.5D Motion Video Recap via Remotion...")
        final_video_path = str(proj_root / f"{project_id}_recap_video.mp4")
        
        # Build Remotion props
        remotion_scenes = []
        for idx, sc in enumerate(scenes):
            remotion_scenes.append({
                "id": f"scene_{idx + 1}",
                "sceneOrder": idx + 1,
                "backgroundUrl": sc.get("backgroundUrl"),
                "foregroundUrl": sc.get("foregroundUrl"),
                "narrationText": sc.get("narration") or sc.get("dialogue"),
                "audioUrl": sc.get("audio_path"),
                "durationInSeconds": max(3.0, sc.get("duration_seconds", 4.0)),
                "cameraMotion": sc.get("camera_motion", "zoom_in"),
                "wordTimestamps": sc.get("word_timestamps", []),
                "sfxType": "whoosh" if idx % 2 == 0 else "sword_slash"
            })

        bgm_file = BASE_DIR / "backend" / "assets" / "default_bgm.mp3"
        bgm_url = str(bgm_file) if bgm_file.exists() else None

        props = remotion_renderer.build_props_json(
            scenes_data=remotion_scenes,
            project_title=story_data["title"],
            bgm_url=bgm_url,
            bgm_volume=0.22,
            fps=30,
            auto_generate_cutouts=False
        )

        try:
            remotion_renderer.render_remotion_video(props, final_video_path)
        except Exception as e:
            print(f"[PrimeOrchestrator] Remotion render notice: {e}")
            final_video_path = None

        elapsed = time.time() - t_start
        print("\n=======================================================")
        print(f"  PRODUKSI SELESAI DALAM {elapsed:.1f} DETIK!")
        print("=======================================================")
        print(f"1. Comic Book PDF   : {pdf_path}")
        print(f"2. Webtoon Strip    : {webtoon_strip_path}")
        if final_video_path and os.path.exists(final_video_path):
            print(f"3. Video Recap MP4  : {final_video_path}")
        print("=======================================================\n")

        manifest = {
            "project_id": project_id,
            "title": story_data["title"],
            "elapsed_seconds": elapsed,
            "files": {
                "comic_pdf": pdf_path,
                "webtoon_strip": webtoon_strip_path,
                "recap_video_mp4": final_video_path,
                "assembled_pages": assembled_pages,
                "script": str(proj_root / "story_script.json")
            }
        }
        with open(proj_root / "manifest.json", "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2)

        return manifest

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prime Agent Master Autonomous Orchestrator")
    parser.add_argument("--project-id", type=str, default=None, help="Project ID or Supabase UUID")
    parser.add_argument("--title", type=str, default="Shadow Sovereign: Bangkitnya Pemburu Bayangan", help="Title of story")
    parser.add_argument("--story", "--synopsis", dest="story", type=str, default="Kaelen, pemburu terlemah terperangkap di dungeon S-Rank. Tetesan darahnya mengaktifkan belati kuno dan membangkitkan pasukan bayangan!", help="Story premise / synopsis")
    parser.add_argument("--genre", type=str, default="Solo Leveling / Dark Fantasy", help="Story genre / art style")
    parser.add_argument("--character", type=str, default="Kaelen", help="Protagonist name")
    parser.add_argument("--character-prompt", type=str, default="1man, solo, messy black hair, glowing blue eyes, black trench coat", help="Character appearance locked prompt")
    parser.add_argument("--script-file", type=str, default=None, help="Path to exported project JSON file")
    parser.add_argument("--full-pipeline", action="store_true", help="Execute complete end-to-end pipeline")
    parser.add_argument("--skip-scraper", action="store_true", help="Skip live browser scraper and use cached/fallback images")
    parser.add_argument("--bgm-preset", type=str, default="epic_battle", help="BGM soundtrack preset")
    args = parser.parse_args()

    orchestrator = PrimeOrchestrator()

    if args.script_file and os.path.exists(args.script_file):
        with open(args.script_file, "r", encoding="utf-8") as f:
            raw_script = json.load(f)
        storyboard = adapt_web_script_to_storyboard(raw_script, project_id=args.project_id)
    else:
        storyboard = generate_default_storyboard(
            title=args.title,
            story=args.story,
            character_name=args.character,
            character_prompt=args.character_prompt,
            genre=args.genre,
            project_id=args.project_id
        )

    orchestrator.run_full_pipeline(storyboard, skip_scraper=args.skip_scraper, bgm_preset=args.bgm_preset)
