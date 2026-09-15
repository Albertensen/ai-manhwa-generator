import os
from pathlib import Path

try:
    from . import config
except (ImportError, ValueError):
    import config

def format_ass_time(seconds: float) -> str:
    """Formats float seconds into ASS timestamp format: H:MM:SS.cs"""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"

def generate_ass_subtitle(
    word_events: list,
    output_path: str,
    max_words_per_line: int = 3,
    font_name: str = "Arial Black",
    font_size: int = 54,
    highlight_bgr: str = r"&H0000E6FF&",  # #FFE600 Yellow Gold
    normal_bgr: str = r"&H00FFFFFF&",     # #FFFFFF White
    outline_bgr: str = r"&H00000000&",    # #000000 Black
    outline_width: float = 4.5,
    margin_v: int = 480                  # Safe vertical zone for TikTok/Shorts
) -> str:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file with
    TikTok / YouTube Shorts Manhwa Recap word-level karaoke dynamic highlight.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    header = f"""[Script Info]
Title: Manhwa Recap Dynamic Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ManhwaKaraoke,{font_name},{font_size},{normal_bgr},{highlight_bgr},{outline_bgr},&H80000000,-1,0,0,0,100,100,2,0,1,{outline_width:.1f},1.5,2,80,80,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    if not word_events:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(header)
        return output_path

    # Chunk words into small phrases (3-4 words max)
    chunks = []
    current_chunk = []
    for w in word_events:
        current_chunk.append(w)
        if len(current_chunk) >= max_words_per_line:
            chunks.append(current_chunk)
            current_chunk = []
    if current_chunk:
        chunks.append(current_chunk)

    dialogues = []
    for chunk in chunks:
        chunk_texts = [w["text"].upper() for w in chunk]
        for active_idx, active_word in enumerate(chunk):
            t_start = active_word["start"]
            t_end = active_word["end"]
            
            # Extend t_end slightly if next word starts shortly after to prevent flicker
            if active_idx < len(chunk) - 1:
                next_start = chunk[active_idx + 1]["start"]
                if next_start > t_start and next_start < t_end + 0.15:
                    t_end = next_start

            formatted_words = []
            for idx, text in enumerate(chunk_texts):
                if idx == active_idx:
                    # Highlighted active word: Pop scale 112% + gold color
                    formatted_words.append(r"{\c" + highlight_bgr + r"\fscx112\fscy112}" + text + r"{\r}")
                else:
                    formatted_words.append(text)
            
            line_text = " ".join(formatted_words)
            start_str = format_ass_time(t_start)
            end_str = format_ass_time(t_end)
            dialogues.append(
                f"Dialogue: 0,{start_str},{end_str},ManhwaKaraoke,,0,0,0,,{line_text}"
            )

    body = "\n".join(dialogues) + "\n"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(header + body)

    return output_path
