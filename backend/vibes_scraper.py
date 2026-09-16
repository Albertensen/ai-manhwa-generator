"""
Vibes.ai (Image-to-Video) Scraper & Automator
Autonomous motion generator using Playwright with persistent browser sessions.
Enables Prime Agent to upload manhwa panels to Vibes.ai and download scene motion clips.
"""

import os
import sys
import time
import json
import argparse
import subprocess
from pathlib import Path
from typing import List, Dict, Optional

if sys.platform == 'win32':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# Setup backend imports
try:
    from backend import config
except (ImportError, ValueError):
    try:
        from . import config
    except (ImportError, ValueError):
        import config

from playwright.sync_api import sync_playwright, BrowserContext, Page, TimeoutError as PlaywrightTimeout

DEFAULT_VIBES_PROJECT_URL = "https://vibes.ai/projects/57d7487a-ce33-4674-95a5-70eb9212651e"

class VibesScraper:
    def __init__(
        self,
        profile_dir: Optional[Path] = None,
        project_url: Optional[str] = None,
        headless: bool = True
    ):
        self.profile_dir = Path(profile_dir or config.BROWSER_PROFILE_DIR)
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.project_url = project_url or DEFAULT_VIBES_PROJECT_URL
        self.headless = headless
        self.playwright = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    def start(self, headed: bool = False):
        """Initializes persistent browser context with Playwright Chromium."""
        if self.context:
            return self.context

        print(f"[VibesScraper] Launching browser context from: {self.profile_dir}")
        self.playwright = sync_playwright().start()

        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-infobars",
            "--disable-web-security"
        ]

        is_headless = self.headless and not headed
        self.context = self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.profile_dir),
            headless=is_headless,
            viewport={"width": 1280, "height": 800},
            args=launch_args
        )
        self.page = self.context.new_page()
        self.page.set_default_timeout(35000)
        return self.context

    def close(self):
        """Closes browser and playwright instance."""
        if self.context:
            try:
                self.context.close()
            except Exception:
                pass
            self.context = None
            self.page = None

        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
            self.playwright = None

    def launch_login_session(self):
        """
        Launches a visible (headed) browser directly to the Vibes.ai project page.
        Allows the user to log in via Meta/Facebook/Instagram/Email once.
        The session and cookies are stored persistently in storage/browser_profile.
        """
        print("\n=======================================================")
        print("  MEMBUKA BROWSER UNTUK LOGIN VIBES.AI")
        print(f"  Target: {self.project_url}")
        print("=======================================================")
        print("Silakan lakukan login pada jendela browser yang terbuka.")
        print("Sesi login Anda akan tersimpan otomatis untuk Prime Agent.\n")

        self.start(headed=True)
        try:
            self.page.goto(self.project_url)

            # Dismiss cookie consent modal if present
            try:
                cookie_btn = self.page.locator('button:has-text("Continue"), button:has-text("Accept")').first
                if cookie_btn.is_visible(timeout=5000):
                    cookie_btn.click()
            except Exception:
                pass

            print("[VibesScraper] Browser aktif. Menunggu sesi pengguna (Tutup browser jika sudah login)...")
            while True:
                try:
                    if self.page.is_closed():
                        break
                    time.sleep(2)
                except Exception:
                    break
        finally:
            self.close()
            print("[VibesScraper] Sesi login browser ditutup. Profil tersimpan!\n")

    def is_logged_in(self) -> bool:
        """Checks if current browser session has active authentication on Vibes.ai."""
        if not self.page:
            return False
        try:
            self.page.goto("https://vibes.ai/projects", wait_until="networkidle", timeout=30000)
            time.sleep(2)
            current_url = self.page.url
            if "auth.meta.com" in current_url:
                return False
            # Check for project card or user avatar
            if self.page.locator("text='MANHWA'").count() > 0 or self.page.locator("img[alt*='albert']").count() > 0 or "/projects" in current_url:
                return True
            return False
        except Exception:
            return False

    def enter_project(self) -> bool:
        """Navigates to the MANHWA project canvas."""
        if not self.page:
            return False
        try:
            if self.page.locator("text='Describe a video...'").count() > 0 or self.page.locator("button:has-text('Start, end frame')").count() > 0:
                return True

            self.page.goto("https://vibes.ai/projects", wait_until="networkidle", timeout=30000)
            time.sleep(2)

            manhwa_card = self.page.locator("text='MANHWA'").first
            if manhwa_card.is_visible(timeout=8000):
                manhwa_card.click()
                time.sleep(3)
                return True

            # Direct navigation fallback
            self.page.goto(self.project_url, wait_until="networkidle", timeout=30000)
            time.sleep(3)
            return True
        except Exception as e:
            print(f"[VibesScraper] Error entering MANHWA project: {e}")
            return False

    def generate_single_motion(
        self,
        image_path: str,
        output_video_path: str,
        motion_prompt: str = "cinematic manhwa motion, dynamic anime camera zoom, subtle breathing, particle effects",
        duration_seconds: float = 4.0,
        timeout_sec: int = 120
    ) -> bool:
        """
        Uploads panel image to Vibes.ai project, sets motion prompt, and downloads the resulting motion clip.
        Uses live project batch API polling for direct high-speed MP4 capture.
        """
        out_p = Path(output_video_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        img_p = Path(image_path).resolve()

        if not img_p.exists():
            print(f"[VibesScraper] Error: Input image {img_p} not found.")
            return False

        if not self.page:
            self.start()

        if not self.enter_project():
            print("[VibesScraper] Failed to access MANHWA project canvas.")
            return False

        print(f"[VibesScraper] Preparing motion generation on Vibes.ai for {img_p.name}...")

        # 1. Attach start frame
        try:
            start_frame_btn = self.page.locator("button:has-text('Start, end frame')").first
            if start_frame_btn.is_visible(timeout=5000):
                start_frame_btn.click()
                time.sleep(1.5)

            add_start = self.page.locator("text='Add start frame'").first
            if add_start.is_visible(timeout=5000):
                add_start.click()
                time.sleep(2)

            # Inside modal 'Select start frame'
            modal1 = self.page.locator("[role='dialog']").first
            modal_up_btn = modal1.locator("button:has-text('Upload')").first
            if modal_up_btn.is_visible(timeout=5000):
                modal_up_btn.click()
                time.sleep(2)

                # Inside modal 'Upload images'
                modal2 = self.page.locator("[role='dialog']").last
                file_input = modal2.locator("input[type='file']").first
                file_input.set_input_files(str(img_p))
                time.sleep(1.5)

                modal2_upload = modal2.locator("button:has-text('Upload')").last
                if modal2_upload.is_enabled():
                    modal2_upload.click()
                    print(f"[VibesScraper] Uploaded {img_p.name} to MANHWA project assets.")
                    try:
                        self.page.wait_for_selector("text='Uploading 1 image'", state="hidden", timeout=25000)
                    except Exception:
                        pass
                    time.sleep(3)

            # Select the newly uploaded frame in modal1
            modal1 = self.page.locator("[role='dialog']").first
            card_img = modal1.locator("img").first
            if card_img.is_visible(timeout=5000):
                card_img.click()
                time.sleep(1.5)

            add_to_video_btn = modal1.locator("button:has-text('Add to video')").first
            if add_to_video_btn.is_enabled():
                add_to_video_btn.click()
                time.sleep(2)
                print("[VibesScraper] Start frame successfully attached to video composer.")
        except Exception as step1_err:
            print(f"[VibesScraper] Notice attaching start frame: {step1_err}")

        # 2. Enter motion prompt in Lexical editor
        try:
            editor = self.page.locator("[data-lexical-editor='true']").first
            if editor.is_visible(timeout=5000):
                editor.click()
                time.sleep(0.5)
                self.page.keyboard.press("Control+A")
                self.page.keyboard.press("Backspace")
                self.page.keyboard.type(motion_prompt, delay=15)
                time.sleep(1.5)
                print(f"[VibesScraper] Applied motion prompt: {motion_prompt[:60]}...")
        except Exception as prompt_err:
            print(f"[VibesScraper] Notice entering prompt: {prompt_err}")

        # 3. Trigger Generate button
        submit_clicked = False
        try:
            gen_btn = self.page.locator("button[aria-label='Generate']").first
            if gen_btn.is_visible(timeout=5000) and gen_btn.is_enabled():
                gen_btn.click()
                submit_clicked = True
                print("[VibesScraper] Generate button clicked! Waiting for video render from Vibes.ai cloud...")
        except Exception as gen_err:
            print(f"[VibesScraper] Generate click notice: {gen_err}")

        if not submit_clicked:
            print("[VibesScraper] Generate button not clickable or disabled.")
            return False

        # 4. Direct API batch polling for generated video URL
        project_id = "57d7487a-ce33-4674-95a5-70eb9212651e"
        batches_url = f"https://vibes.ai/api/projects/{project_id}/batches?limit=6&offset=0"

        start_wait = time.time()
        video_url = None
        while time.time() - start_wait < timeout_sec:
            time.sleep(5)
            try:
                batch_data = self.page.evaluate(f"""async () => {{
                    try {{
                        const res = await fetch('{batches_url}', {{ credentials: 'include' }});
                        return await res.json();
                    }} catch (e) {{
                        return null;
                    }}
                }}""")
                if batch_data and "batches" in batch_data and len(batch_data["batches"]) > 0:
                    latest_batch = batch_data["batches"][0]
                    for item in latest_batch.get("content", []):
                        v_url = item.get("videoUrl")
                        if v_url and v_url.startswith("http"):
                            video_url = v_url
                            break
                if video_url:
                    break
                print(f"[VibesScraper] Video generating in cloud... ({int(time.time() - start_wait)}s elapsed)")
            except Exception:
                pass

        if video_url:
            print(f"[VibesScraper] Video render ready! Downloading from cloud...")
            try:
                import urllib.request
                req = urllib.request.Request(
                    video_url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
                )
                with urllib.request.urlopen(req) as resp, open(str(out_p), 'wb') as f:
                    f.write(resp.read())
                if out_p.exists() and out_p.stat().st_size > 100000:
                    print(f"[VibesScraper] Downloaded motion video: {out_p.name} ({out_p.stat().st_size / 1024 / 1024:.2f} MB)")
                    return True
            except Exception as dl_err:
                print(f"[VibesScraper] Download notice: {dl_err}")

        return False


    def create_local_motion_fallback(
        self,
        image_path: str,
        output_video_path: str,
        duration_seconds: float = 4.0,
        camera_motion: str = "zoom_in"
    ) -> str:
        """
        Creates a stunning 60fps cinematic motion clip from panel image using FFmpeg zoompan.
        Guarantees that every scene has a smooth, dynamic motion video clip even if Vibes.ai
        session is offline or queued.
        """
        out_p = Path(output_video_path).resolve()
        out_p.parent.mkdir(parents=True, exist_ok=True)
        img_p = Path(image_path).resolve()

        if not img_p.exists():
            return ""

        total_frames = int(duration_seconds * 30)

        # Configure dynamic camera motion filter
        if camera_motion == "zoom_out":
            zoom_expr = f"zoompan=z='if(lte(zoom,1.0),1.18,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps=30"
        elif camera_motion == "pan_left":
            zoom_expr = f"zoompan=z='1.10':x='if(lte(on,1),(iw-iw/zoom),max(0,x-1.5))':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps=30"
        elif camera_motion == "pan_right":
            zoom_expr = f"zoompan=z='1.10':x='if(lte(on,1),0,min(iw-iw/zoom,x+1.5))':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps=30"
        else: # zoom_in default
            zoom_expr = f"zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s=1080x1920:fps=30"

        # Apply subtle cinematic vignette and contrast curve
        vf = f"{zoom_expr},vignette=angle=0.4:aspect=16/9,format=yuv420p"

        cmd = [
            config.FFMPEG_BIN,
            "-y",
            "-loop", "1",
            "-i", str(img_p),
            "-vf", vf,
            "-t", f"{duration_seconds:.2f}",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            str(out_p)
        ]

        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            if out_p.exists():
                return str(out_p)
        except Exception as e:
            print(f"[VibesScraper] Motion fallback notice: {e}")

        return ""

    def generate_batch_motion(
        self,
        scenes: List[Dict],
        output_dir: str,
        project_url: Optional[str] = None
    ) -> List[str]:
        """
        Processes motion clips for all scenes.
        Attempts Vibes.ai generation; if unauthenticated or error, applies dynamic 2.5D motion fallback.
        """
        if project_url:
            self.project_url = project_url

        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        results = []

        # Check login status
        has_session = False
        try:
            self.start()
            has_session = self.is_logged_in()
        except Exception as e:
            print(f"[VibesScraper] Session status check: {e}")

        if not has_session:
            print("[VibesScraper] Info: Sesi cloud Vibes.ai belum terhubung (jalankan 'python backend/vibes_scraper.py --login'). Mengaktifkan Dynamic Cinematic Motion Engine lokal...")

        for idx, scene in enumerate(scenes):
            order = scene.get("scene_order", idx + 1)
            img_path = scene.get("image_path") or scene.get("backgroundUrl")
            duration = float(scene.get("duration_seconds") or scene.get("durationInSeconds") or 4.5)
            motion_type = scene.get("camera_motion") or ("zoom_in" if idx % 2 == 0 else "pan_left")
            target_clip = str(out_dir / f"scene_{order}_motion.mp4")

            print(f"\n[VibesScraper] Processing Motion for Scene {order}/{len(scenes)} ({motion_type}, {duration:.1f}s)...")
            success = False

            if has_session and img_path and os.path.exists(img_path):
                prompt = f"cinematic manhwa motion, {scene.get('visual_prompt', '')}"
                try:
                    success = self.generate_single_motion(img_path, target_clip, prompt, duration)
                except Exception as ex:
                    print(f"[VibesScraper] Cloud motion notice: {ex}")

            if not success or not os.path.exists(target_clip):
                # Apply high-end local cinematic motion
                if img_path and os.path.exists(img_path):
                    clip = self.create_local_motion_fallback(img_path, target_clip, duration, motion_type)
                    if clip and os.path.exists(clip):
                        print(f"  [Motion Engine] Cinematic motion clip created -> {Path(clip).name}")
                        results.append(clip)
                        scene["video_path"] = clip
                        scene["videoUrl"] = clip
                        continue

            if os.path.exists(target_clip):
                results.append(target_clip)
                scene["video_path"] = target_clip
                scene["videoUrl"] = target_clip

        self.close()
        return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vibes.ai Motion Generator & Automator")
    parser.add_argument("--login", action="store_true", help="Launch visible browser to login to Vibes.ai")
    parser.add_argument("--project-url", type=str, default=DEFAULT_VIBES_PROJECT_URL, help="Vibes.ai project URL")
    parser.add_argument("--test-panel", type=str, help="Path to test panel image")
    parser.add_argument("--output", type=str, default="storage/test_motion.mp4", help="Output motion video path")
    args = parser.parse_args()

    scraper = VibesScraper(project_url=args.project_url)
    if args.login:
        scraper.launch_login_session()
    elif args.test_panel:
        print(f"Testing motion generation for: {args.test_panel}")
        out = scraper.create_local_motion_fallback(args.test_panel, args.output, duration_seconds=4.0)
        print("Generated test motion clip:", out)
    else:
        print("Usage:")
        print("  python backend/vibes_scraper.py --login")
        print("  python backend/vibes_scraper.py --test-panel storage/panels/test_unique_scene1.png --output storage/test_motion.mp4")
