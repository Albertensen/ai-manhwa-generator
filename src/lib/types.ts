export interface ManhwaProject {
  id: string;
  title: string;
  synopsis: string;
  genre: string;
  art_style: string;
  status: 'draft' | 'generating_story' | 'story_ready' | 'rendering' | 'stitching' | 'completed';
  created_at: string;
  updated_at: string;
  characters?: ManhwaCharacter[];
  scenes?: ManhwaScene[];
  video_url?: string | null;
  video_job?: ManhwaVideoJob | null;
}

export interface ManhwaCharacter {
  id: string;
  project_id: string;
  name: string;
  gender: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
  appearance_locked_prompt: string;
  negative_prompt: string;
  reference_image_url?: string;
}

export interface ManhwaScene {
  id: string;
  project_id: string;
  scene_order: number;
  character_id?: string;
  character_name?: string;
  narration_text: string;
  dialogue_text?: string;
  visual_prompt: string;
  negative_prompt: string;
  camera_motion: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'static' | 'action' | 'tilt_up' | 'orbital';
  voice_emotion: 'dramatic' | 'intense' | 'calm' | 'whisper' | 'angry';
  status: 'pending' | 'generating_image' | 'animating' | 'compositing' | 'image_ready' | 'generating_audio' | 'audio_ready' | 'ready' | 'failed';
  image_url?: string;
  audio_url?: string;
  duration_seconds: number;
  error_message?: string;
}

export interface ManhwaVideoJob {
  id: string;
  project_id: string;
  status: 'pending' | 'processing' | 'rendering' | 'stitching' | 'completed' | 'failed';
  progress_percent: number;
  video_url?: string;
  error_message?: string;
}
