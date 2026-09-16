export type ComicLayoutType = 'webtoon' | 'action' | 'classic';

export type BubbleType = 'oval' | 'shout' | 'thought' | 'whisper';

export interface MangaPanelData {
  id: string;
  panelNumber: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: number[]; // For slanted / non-rectangular polygon panels
  imageUrl?: string | null;
  visualPrompt: string;
  dialogue: string;
  speaker: string;
  sfxPrompt?: string;
  audioUrl?: string | null;
  durationSeconds?: number;
}

export interface SpeechBubbleData {
  id: string;
  panelId?: string;
  type: BubbleType;
  x: number;
  y: number;
  width: number;
  height: number;
  tailX: number; // Tail end position relative to bubble x
  tailY: number; // Tail end position relative to bubble y
  text: string;
  speaker?: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

export interface SfxStickerData {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
  color: string;
  strokeColor: string;
  stylePreset: 'slash' | 'impact' | 'magic' | 'scream';
}

export interface MangaPageData {
  id: string;
  pageNumber: number;
  title: string;
  layout: ComicLayoutType;
  canvasWidth: number;
  canvasHeight: number;
  gutterSize: number;
  backgroundColor: string;
  panels: MangaPanelData[];
  bubbles: SpeechBubbleData[];
  sfxStickers: SfxStickerData[];
}

export interface CharacterSheet {
  id: string;
  name: string;
  role: 'protagonist' | 'heroine' | 'antagonist' | 'supporting';
  appearance_locked_prompt: string;
  reference_image_url?: string | null;
  colorTag: string;
}
