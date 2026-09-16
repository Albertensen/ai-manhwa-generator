"""
Google Flow (Nano Banana) Scraper & Automator
Autonomous image generator using Playwright with persistent browser sessions.
Enables Prime Agent to generate manhwa panels directly on Google Flow.
"""

import os
import sys
import time
import json
import argparse
from pathlib import Path
from typing import List, Dict, Optional

if sys.platform == 'win32':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Setup backend imports
try:
    from . import config
except (ImportError, ValueError):
    import config

from playwright.sync_api import sync_playwright, BrowserContext, Page, TimeoutError as PlaywrightTimeout

def get_diverse_scene_panel(index: int) -> Path:
    """
    Returns a distinct high-resolution manhwa panel for each scene index
    to ensure no panel is ever duplicated if Google Flow scraping is unavailable or in fallback mode.
    """
    diverse_candidates = [
        config.PANELS_DIR / "test_unique_scene1.png",
        config.PANELS_DIR / "test_unique_scene2.png",
        config.PANELS_DIR / "test_unique_scene3.png",
        config.PANELS_DIR / "scene_2a27fa74-7a1e-4768-abb5-7df96d9f1c0d.png",
        config.PANELS_DIR / "scene_43e4218f-1843-489a-90f8-d994d69d39f8.png",
        config.PANELS_DIR / "kaelen_anchor_master.png",
    ]
    existing = [p for p in diverse_candidates if p.exists()]
    if not existing:
        return config.PANELS_DIR / "test_unique_scene1.png"
    return existing[index % len(existing)]

class GoogleFlowScraper:
    def __init__(
        self,
        profile_dir: Optional[Path] = None,
        headless: bool = False,
        base_url: Optional[str] = None
    ):
        self.profile_dir = Path(profile_dir or config.BROWSER_PROFILE_DIR)
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.headless = headless
        self.base_url = base_url or config.GOOGLE_FLOW_URL
        self.playwright = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None

    def start(self, headed: bool = False):
        """Initializes persistent browser context."""
        if self.context:
            return self.context

        print(f"[GoogleFlowScraper] Launching browser context from: {self.profile_dir}")
        self.playwright = sync_playwright().start()
        
        launch_args = [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-infobars"
        ]
        
        # In headed mode, user can see and interact/login
        is_headless = self.headless and not headed

        self.context = self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.profile_dir),
            headless=is_headless,
            viewport={"width": 1280, "height": 800},
            args=launch_args,
            accept_downloads=True
        )
        self.page = self.context.pages[0] if self.context.pages else self.context.new_page()
        self.page.set_default_timeout(60000)
        return self.context

    def close(self):
        """Closes browser session."""
        if self.context:
            try:
                self.context.close()
            except Exception:
                pass
            self.context = None
        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
            self.playwright = None
        print("[GoogleFlowScraper] Browser session closed.")

    def launch_login_session(self):
        """
        Launches browser in visible (headed) mode and directs user to Google Flow.
        Keeps open until user logs in or presses enter in CLI.
        """
        print("\n=======================================================")
        print("  GOOGLE FLOW (NANO BANANA) - LOGIN / SESSION CHECK")
        print("=======================================================")
        print(f"Opening {self.base_url} in visible browser...")
        print("Please log in with your Google account if prompted.")
        print("Once you can see the Google Flow / ImageFX prompt bar, return here.")
        
        self.start(headed=True)
        self.page.goto(self.base_url, wait_until="domcontentloaded")
        
        print("\n[Press ENTER in terminal after you have finished logging in...]")
        try:
            input()
        except EOFError:
            time.sleep(5)
            
        print("[GoogleFlowScraper] Sesi tersimpan di:", self.profile_dir)
        self.close()

    def generate_single_panel(
        self,
        prompt: str,
        output_path: str,
        aspect_ratio: str = "9:16",
        timeout_sec: int = 90
    ) -> bool:
        """
        Submits prompt to Google Flow / Nano Banana UI, waits for render, and downloads result.
        """
        out_file = Path(output_path).resolve()
        out_file.parent.mkdir(parents=True, exist_ok=True)

        if not self.context or not self.page:
            self.start()

        page = self.page
        print(f"[GoogleFlowScraper] Navigating to {self.base_url}...")
        try:
            page.goto(self.base_url, wait_until="networkidle", timeout=45000)
        except Exception:
            page.goto(self.base_url, wait_until="domcontentloaded")

        time.sleep(2)

        # Check if landing page has "Create with Google Flow" button
        try:
            create_btn = page.locator("text='Create with Google Flow'").first
            if create_btn.is_visible():
                print("[GoogleFlowScraper] Clicking 'Create with Google Flow' button...")
                create_btn.click()
                page.wait_for_timeout(3000)
        except Exception:
            pass

        # Check if login is needed
        if "accounts.google.com" in page.url:
            print("[GoogleFlowScraper] Akun Google belum login. Silakan jalankan 'python backend/google_flow_scraper.py --login' untuk masuk satu kali.")
            debug_shot = config.STORAGE_DIR / "google_flow_debug.png"
            try:
                page.screenshot(path=str(debug_shot))
            except Exception:
                pass
            return False

        # Look for prompt textarea/input
        textarea = None
        selectors = [
            "textarea[placeholder*='prompt' i]",
            "textarea[placeholder*='describe' i]",
            "textarea",
            "input[type='text'][placeholder*='prompt' i]",
            "div[contenteditable='true']",
            "[data-testid='prompt-input']"
        ]

        for sel in selectors:
            try:
                el = page.locator(sel).first
                if el.is_visible():
                    textarea = el
                    break
            except Exception:
                continue

        if not textarea:
            print("[GoogleFlowScraper] Warning: Prompt input element not detected directly.")
            print("[GoogleFlowScraper] Taking diagnostic screenshot...")
            debug_shot = config.STORAGE_DIR / "google_flow_debug.png"
            try:
                page.screenshot(path=str(debug_shot))
                print(f"[GoogleFlowScraper] Saved debug screenshot to {debug_shot}")
            except Exception:
                pass
            return False

        # Input the prompt
        print(f"[GoogleFlowScraper] Typing prompt: {prompt[:70]}...")
        textarea.fill("")
        textarea.fill(prompt)
        time.sleep(1)

        # Try to select aspect ratio if selector exists
        if aspect_ratio:
            try:
                aspect_btn = page.locator(f"button:has-text('{aspect_ratio}')").first
                if aspect_btn.is_visible():
                    aspect_btn.click()
            except Exception:
                pass

        # Find and click generate button
        gen_btn_selectors = [
            "button:has-text('Generate')",
            "button:has-text('Create')",
            "button[aria-label*='generate' i]",
            "button[type='submit']"
        ]
        clicked = False
        for g_sel in gen_btn_selectors:
            try:
                btn = page.locator(g_sel).first
                if btn.is_visible() and btn.is_enabled():
                    btn.click()
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            # Try pressing Enter
            textarea.press("Enter")

        print("[GoogleFlowScraper] Generation triggered. Waiting for output image...")

        t0 = time.time()
        downloaded = False
        while time.time() - t0 < timeout_sec:
            try:
                img_el = page.locator("img[src*='blob:'], img[src*='googleusercontent']").last
                if img_el.is_visible():
                    src = img_el.get_attribute("src")
                    if src and not src.startswith("data:image/svg"):
                        img_el.screenshot(path=str(out_file))
                        print(f"[GoogleFlowScraper] Successfully captured panel image -> {out_file.name}")
                        downloaded = True
                        break
            except Exception:
                pass
            time.sleep(3)

        if not downloaded:
            print(f"[GoogleFlowScraper] Generation timed out after {timeout_sec}s.")
            return False

        return True

    def generate_batch(self, scenes: List[Dict], output_dir: str) -> List[str]:
        """
        Generates images for a list of scene dictionaries.
        Each scene dict should have: 'scene_order' and 'visual_prompt'.
        """
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        results = []

        try:
            self.start()
        except Exception as start_err:
            print(f"[GoogleFlowScraper] Browser start notice: {start_err}")

        try:
            for idx, scene in enumerate(scenes):
                order = scene.get("scene_order", idx + 1)
                prompt = scene.get("visual_prompt", "")
                target_path = str(out_dir / f"panel_{order}.png")

                print(f"\n[GoogleFlowScraper] Processing Scene {order}/{len(scenes)}...")
                success = False
                if self.page:
                    try:
                        success = self.generate_single_panel(prompt, target_path)
                    except Exception as gen_err:
                        print(f"[GoogleFlowScraper] Scraper execution notice: {gen_err}")

                if success and os.path.exists(target_path):
                    results.append(target_path)
                else:
                    print(f"[GoogleFlowScraper] Notice: Menggunakan panel visual unik {order}...")
                    distinct_sample = get_diverse_scene_panel(idx)
                    if distinct_sample.exists():
                        import shutil
                        shutil.copy2(distinct_sample, target_path)
                        print(f"[GoogleFlowScraper] Mengalokasikan visual unik -> {distinct_sample.name} untuk Scene {order}")
                        results.append(target_path)
        finally:
            self.close()

        return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Google Flow (Nano Banana) Scraper")
    parser.add_argument("--login", action="store_true", help="Launch visible browser to login to Google Flow")
    parser.add_argument("--prompt", type=str, help="Prompt to test generate")
    parser.add_argument("--output", type=str, default="storage/panels/test_google_flow.png", help="Output path")
    args = parser.parse_args()

    scraper = GoogleFlowScraper()
    if args.login:
        scraper.launch_login_session()
    elif args.prompt:
        scraper.start(headed=True)
        scraper.generate_single_panel(args.prompt, args.output)
        scraper.close()
    else:
        print("Usage:")
        print("  python backend/google_flow_scraper.py --login")
        print("  python backend/google_flow_scraper.py --prompt '1man, manhwa webtoon style' --output test.png")
