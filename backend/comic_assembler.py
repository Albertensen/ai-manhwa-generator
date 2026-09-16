"""
Headless Comic Assembler & Stager
Assembles raw AI panels into professional comic pages with vector-like speech bubbles,
onomatopoeia SFX typography, Webtoon long-strip stitching, and multi-page PDF generation.
"""

import os
import sys
import math
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont

# Setup backend imports
try:
    from . import config
except (ImportError, ValueError):
    import config

class ComicAssembler:
    def __init__(
        self,
        canvas_width: int = 1440,
        canvas_height: int = 2160,
        gutter_size: int = 24,
        bg_color: str = "#0f172a"
    ):
        self.width = canvas_width
        self.height = canvas_height
        self.gutter = gutter_size
        self.bg_color = bg_color
        self._load_fonts()

    def _load_fonts(self):
        """Loads available system fonts or fallbacks."""
        # Try Windows fonts
        font_paths = [
            r"C:\Windows\Fonts\impact.ttf",
            r"C:\Windows\Fonts\comic.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\arial.ttf",
            r"C:\Windows\Fonts\segoeui.ttf"
        ]
        self.impact_font_path = r"C:\Windows\Fonts\impact.ttf" if os.path.exists(r"C:\Windows\Fonts\impact.ttf") else None
        self.dialogue_font_path = r"C:\Windows\Fonts\comic.ttf" if os.path.exists(r"C:\Windows\Fonts\comic.ttf") else r"C:\Windows\Fonts\arialbd.ttf"
        if not os.path.exists(str(self.dialogue_font_path)):
            self.dialogue_font_path = None

    def get_font(self, font_type: str, size: int):
        """Retrieves font at requested size."""
        try:
            if font_type == "sfx" and self.impact_font_path:
                return ImageFont.truetype(self.impact_font_path, size)
            if self.dialogue_font_path:
                return ImageFont.truetype(self.dialogue_font_path, size)
        except Exception:
            pass
        return ImageFont.load_default()

    def _fit_image_to_panel(self, image_path: str, target_w: int, target_h: int) -> Image.Image:
        """Crops and fits an image into target panel dimensions maintaining aspect ratio."""
        if not os.path.exists(image_path):
            # Generate dark placeholder
            img = Image.new("RGB", (target_w, target_h), "#1e293b")
            draw = ImageDraw.Draw(img)
            draw.rectangle([0, 0, target_w, target_h], outline="#475569", width=2)
            draw.text((target_w // 4, target_h // 2), "[Panel Image Slot]", fill="#94a3b8")
            return img

        src = Image.open(image_path).convert("RGB")
        src_w, src_h = src.size
        src_ratio = src_w / src_h
        target_ratio = target_w / target_h

        if src_ratio > target_ratio:
            # Source is wider, scale to height and crop width
            new_h = target_h
            new_w = int(target_h * src_ratio)
            resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
            offset_x = (new_w - target_w) // 2
            cropped = resized.crop((offset_x, 0, offset_x + target_w, target_h))
        else:
            # Source is taller, scale to width and crop height
            new_w = target_w
            new_h = int(target_w / src_ratio)
            resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
            offset_y = (new_h - target_h) // 2
            cropped = resized.crop((0, offset_y, target_w, offset_y + target_h))

        return cropped

    def _calculate_panels_layout(self, layout_type: str) -> List[Dict]:
        """Calculates bounding boxes for panels on the canvas."""
        margin_x = 48
        margin_y = 48
        w = self.width - (2 * margin_x)
        h = self.height - (2 * margin_y)
        g = self.gutter

        if layout_type == "webtoon":
            # 3 vertical stacked panels
            panel_h = (h - (2 * g)) // 3
            return [
                {"order": 1, "x": margin_x, "y": margin_y, "w": w, "h": panel_h},
                {"order": 2, "x": margin_x, "y": margin_y + panel_h + g, "w": w, "h": panel_h},
                {"order": 3, "x": margin_x, "y": margin_y + (panel_h + g) * 2, "w": w, "h": panel_h},
            ]
        elif layout_type == "action":
            # 4 panels: Top wide, middle 2-split, bottom wide
            top_h = int(h * 0.28)
            mid_h = int(h * 0.40)
            bot_h = h - top_h - mid_h - (3 * g)
            mid_w = (w - g) // 2
            return [
                {"order": 1, "x": margin_x, "y": margin_y, "w": w, "h": top_h},
                {"order": 2, "x": margin_x, "y": margin_y + top_h + g, "w": mid_w, "h": mid_h},
                {"order": 3, "x": margin_x + mid_w + g, "y": margin_y + top_h + g, "w": mid_w, "h": mid_h},
                {"order": 4, "x": margin_x, "y": margin_y + top_h + mid_h + (2 * g), "w": w, "h": bot_h},
            ]
        else:
            # Classic 2x2 grid
            panel_w = (w - g) // 2
            panel_h = (h - g) // 2
            return [
                {"order": 1, "x": margin_x, "y": margin_y, "w": panel_w, "h": panel_h},
                {"order": 2, "x": margin_x + panel_w + g, "y": margin_y, "w": panel_w, "h": panel_h},
                {"order": 3, "x": margin_x, "y": margin_y + panel_h + g, "w": panel_w, "h": panel_h},
                {"order": 4, "x": margin_x + panel_w + g, "y": margin_y + panel_h + g, "w": panel_w, "h": panel_h},
            ]

    def _draw_speech_bubble(
        self,
        draw: ImageDraw.Draw,
        x: int,
        y: int,
        w: int,
        h: int,
        text: str,
        speaker: Optional[str] = None,
        bubble_type: str = "oval"
    ):
        """Draws a stylized comic speech bubble with wrapped text."""
        # Bubble container
        fill_color = "#ffffff"
        border_color = "#e11d48" if bubble_type == "shout" else "#000000"
        border_width = 4 if bubble_type == "shout" else 3

        if bubble_type == "shout":
            # Spiky jagged shout polygon
            spikes = 12
            pts = []
            cx = x + w / 2
            cy = y + h / 2
            rx = w / 2
            ry = h / 2
            for i in range(spikes * 2):
                angle = i * math.pi / spikes
                r_scale = 1.15 if i % 2 == 1 else 0.88
                px = cx + rx * r_scale * math.cos(angle)
                py = cy + ry * r_scale * math.sin(angle)
                pts.append((px, py))
            draw.polygon(pts, fill=fill_color, outline=border_color, width=border_width)
        else:
            # Rounded oval bubble
            corner_radius = min(w, h) // 4
            draw.rounded_rectangle([x, y, x + w, y + h], radius=corner_radius, fill=fill_color, outline=border_color, width=border_width)
            # Draw simple pointer tail
            tail_x = x + 30
            tail_y = y + h
            draw.polygon([(tail_x, tail_y - 2), (tail_x + 25, tail_y - 2), (tail_x + 5, tail_y + 24)], fill=fill_color, outline=border_color)
            draw.line([(tail_x + 1, tail_y), (tail_x + 24, tail_y)], fill=fill_color, width=border_width)

        # Draw speaker badge if present
        font_speaker = self.get_font("dialogue", 22)
        font_text = self.get_font("dialogue", 26)

        text_y = y + 14
        if speaker:
            draw.text((x + 20, text_y), f"[{speaker}]", fill="#4f46e5", font=font_speaker)
            text_y += 28

        # Word wrap text
        import textwrap
        lines = textwrap.wrap(text, width=22)
        for line in lines[:4]:
            draw.text((x + 20, text_y), line, fill="#0f172a", font=font_text)
            text_y += 32

    def _draw_sfx_sticker(
        self,
        base_img: Image.Image,
        text: str,
        x: int,
        y: int,
        rotation: int = -8,
        font_size: int = 72,
        color: str = "#f59e0b",
        stroke_color: str = "#000000"
    ):
        """Draws an onomatopoeia action sound effect with rotation and drop shadow."""
        font = self.get_font("sfx", font_size)
        # Create separate transparent canvas for rotation
        sfx_w = int(len(text) * font_size * 0.8) + 80
        sfx_h = font_size + 80
        sfx_layer = Image.new("RGBA", (sfx_w, sfx_h), (0, 0, 0, 0))
        s_draw = ImageDraw.Draw(sfx_layer)

        # Draw stroke/outline
        offset = 5
        s_draw.text((30 + offset, 30 + offset), text, font=font, fill=stroke_color, stroke_width=6, stroke_fill=stroke_color)
        s_draw.text((30, 30), text, font=font, fill=color, stroke_width=4, stroke_fill=stroke_color)

        # Rotate layer
        rotated = sfx_layer.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=True)
        base_img.paste(rotated, (x, y), rotated)

    def assemble_page(
        self,
        page_data: Dict,
        output_path: str
    ) -> str:
        """
        Assembles a single comic page.
        page_data: {
          'layout': 'webtoon' | 'action' | 'classic',
          'panels': [{'order': 1, 'image_path': '...', 'dialogue': '...', 'speaker': '...', 'sfx': '...'}]
        }
        """
        layout_type = page_data.get("layout", "webtoon")
        panels_meta = page_data.get("panels", [])

        page_img = Image.new("RGB", (self.width, self.height), self.bg_color)
        draw = ImageDraw.Draw(page_img)

        layout_boxes = self._calculate_panels_layout(layout_type)

        # Place panels
        for i, box in enumerate(layout_boxes):
            panel_info = panels_meta[i] if i < len(panels_meta) else {}
            img_path = panel_info.get("image_path", "")
            
            # Crop and paste panel
            panel_img = self._fit_image_to_panel(img_path, box["w"], box["h"])
            page_img.paste(panel_img, (box["x"], box["y"]))

            # Panel border
            draw.rectangle([box["x"], box["y"], box["x"] + box["w"], box["y"] + box["h"]], outline="#334155", width=3)

            # Panel number badge
            draw.rectangle([box["x"] + 12, box["y"] + 12, box["x"] + 56, box["y"] + 46], fill="#000000")
            draw.text((box["x"] + 24, box["y"] + 18), str(box["order"]), fill="#ffffff", font=self.get_font("dialogue", 20))

            # Draw Speech Bubble if dialogue exists
            dialogue = panel_info.get("dialogue") or panel_info.get("narration")
            if dialogue:
                b_type = panel_info.get("bubble_type", "shout" if i % 2 == 1 else "oval")
                b_w = min(420, box["w"] - 60)
                b_h = 160
                b_x = box["x"] + 40
                b_y = box["y"] + 30
                self._draw_speech_bubble(draw, b_x, b_y, b_w, b_h, dialogue, speaker=panel_info.get("speaker"), bubble_type=b_type)

            # Draw SFX sticker if exists
            sfx = panel_info.get("sfx")
            if sfx:
                sfx_x = box["x"] + box["w"] - 320
                sfx_y = box["y"] + box["h"] - 160
                self._draw_sfx_sticker(page_img, sfx, sfx_x, sfx_y, rotation=-10 if i%2==0 else 12)

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        page_img.save(output_path, quality=95)
        print(f"[ComicAssembler] Assembled page saved to: {output_path}")
        return output_path

    def export_pdf(self, page_paths: List[str], output_pdf: str) -> str:
        """Combines multiple assembled page PNGs into a print-ready PDF book."""
        if not page_paths:
            return ""
        images = [Image.open(p).convert("RGB") for p in page_paths if os.path.exists(p)]
        if not images:
            return ""

        first = images[0]
        rest = images[1:] if len(images) > 1 else []
        os.makedirs(os.path.dirname(os.path.abspath(output_pdf)), exist_ok=True)
        first.save(output_pdf, save_all=True, append_images=rest)
        print(f"[ComicAssembler] Multi-page PDF created at: {output_pdf}")
        return output_pdf

    def export_webtoon_strip(self, page_paths: List[str], output_strip: str) -> str:
        """Stitches multiple pages vertically into one long continuous Webtoon strip."""
        if not page_paths:
            return ""
        images = [Image.open(p).convert("RGB") for p in page_paths if os.path.exists(p)]
        if not images:
            return ""

        total_h = sum(im.height for im in images)
        max_w = max(im.width for im in images)

        strip = Image.new("RGB", (max_w, total_h), self.bg_color)
        current_y = 0
        for im in images:
            strip.paste(im, (0, current_y))
            current_y += im.height

        os.makedirs(os.path.dirname(os.path.abspath(output_strip)), exist_ok=True)
        strip.save(output_strip, quality=90)
        print(f"[ComicAssembler] Webtoon continuous strip created at: {output_strip}")
        return output_strip

if __name__ == "__main__":
    # Self-test using existing sample image
    sample_img = str(Path(__file__).resolve().parent.parent / "test_kaelen_cloud_scene1.png")
    assembler = ComicAssembler()
    
    test_page = {
        "layout": "webtoon",
        "panels": [
            {"order": 1, "image_path": sample_img, "dialogue": "Di reruntuhan dungeon ini... aku tidak akan mati sia-sia!", "speaker": "Kaelen", "bubble_type": "oval", "sfx": None},
            {"order": 2, "image_path": sample_img, "dialogue": "Aura bayangan raja kuno... bangkit di dalam darahku!", "speaker": "Kaelen", "bubble_type": "oval", "sfx": "CRASH!!"},
            {"order": 3, "image_path": sample_img, "dialogue": "BANGKITLAH, TENTARA BAYANGAN!", "speaker": "Kaelen", "bubble_type": "shout", "sfx": "DUMMM!"}
        ]
    }
    
    out_png = str(config.STORAGE_DIR / "test_comic_page_1.png")
    out_pdf = str(config.STORAGE_DIR / "test_comic_book.pdf")
    
    assembler.assemble_page(test_page, out_png)
    assembler.export_pdf([out_png], out_pdf)
    print("Self-test completed successfully!")
