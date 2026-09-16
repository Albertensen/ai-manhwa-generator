"use client";

import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { ManhwaRecapComposition } from '@/remotion/compositions/ManhwaRecapComposition';
import { ManhwaRecapProps, SceneItem } from '@/remotion/types';
import { ManhwaScene } from '@/lib/types';
import { Film, Play, Sparkles, Layers, Volume2, Info } from 'lucide-react';

interface RemotionPreviewPlayerProps {
  projectTitle?: string;
  scenes?: ManhwaScene[];
  uploadedClips?: Record<number, string>;
  bgmPreset?: string;
  bgmVolume?: number;
}

export const RemotionPreviewPlayer: React.FC<RemotionPreviewPlayerProps> = ({
  projectTitle = 'AI Manhwa Recap',
  scenes = [],
  uploadedClips = {},
  bgmPreset = 'epic_battle',
  bgmVolume = 0.25,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'info'>('preview');

  // Format scenes into Remotion SceneItem array
  const sceneItems: SceneItem[] = useMemo(() => {
    if (!scenes || scenes.length === 0) {
      return [
        {
          id: 'preview-sample-1',
          sceneOrder: 1,
          backgroundUrl:
            'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/panels/kaelen_scene1_upgraded.png',
          narrationText:
            'Kaelen berdiri kokoh menyambut aura kegelapan yang bangkit dari kedalaman dungeon S-Rank.',
          cameraMotion: 'zoom_in',
          durationInSeconds: 4.0,
          sfxType: 'whoosh',
        },
      ];
    }

    return scenes.map((s, idx) => {
      const scNum = s.scene_order || idx + 1;
      const rawImage =
        uploadedClips[scNum] ||
        s.image_url ||
        'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/panels/kaelen_scene1_upgraded.png';

      let camMotion: SceneItem['cameraMotion'] = 'zoom_in';
      if (s.camera_motion === 'zoom_out') camMotion = 'zoom_out';
      else if (s.camera_motion === 'pan_left') camMotion = 'pan_left';
      else if (s.camera_motion === 'pan_right') camMotion = 'pan_right';
      else if (s.camera_motion === 'tilt_up') camMotion = 'tilt_up';

      const sfxOptions: Array<'whoosh' | 'sword_slash' | 'impact_boom'> = [
        'whoosh',
        'sword_slash',
        'impact_boom',
      ];
      const assignedSfx = sfxOptions[idx % sfxOptions.length];

      return {
        id: s.id || `scene-${scNum}`,
        sceneOrder: scNum,
        backgroundUrl: rawImage,
        narrationText:
          s.narration_text ||
          s.dialogue_text ||
          `Adegan ${scNum}: Sensasi ketegangan meningkat drastis!`,
        audioUrl: s.audio_url || undefined,
        sfxType: assignedSfx,
        cameraMotion: camMotion,
        durationInSeconds: Math.max(3.0, s.duration_seconds || 4.0),
      };
    });
  }, [scenes, uploadedClips]);

  // Calculate total duration in frames (30 fps)
  const totalDurationInFrames = useMemo(() => {
    const totalSecs = sceneItems.reduce(
      (acc, sc) => acc + (sc.durationInSeconds || 4),
      0
    );
    return Math.max(30, Math.round(totalSecs * 30));
  }, [sceneItems]);

  const bgmMap: Record<string, string> = {
    epic_battle:
      'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/bgm/epic_battle.mp3',
    mystery_dungeon:
      'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/bgm/mystery_dungeon.mp3',
    melancholy_sad:
      'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/bgm/melancholy_sad.mp3',
  };

  const inputProps: ManhwaRecapProps = useMemo(() => {
    return {
      projectTitle,
      bgmUrl: bgmMap[bgmPreset] || bgmMap.epic_battle,
      bgmVolume,
      fps: 30,
      scenes: sceneItems,
    };
  }, [projectTitle, bgmPreset, bgmVolume, sceneItems]);

  const durationSec = (totalDurationInFrames / 30).toFixed(1);

  return (
    <div className="rounded-2xl bg-slate-950 border border-indigo-500/30 overflow-hidden shadow-2xl flex flex-col">
      {/* Player Header */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Remotion 2.5D Real-Time Canvas
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[9px] font-bold text-indigo-300 border border-indigo-500/30">
                LIVE PREVIEW
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {sceneItems.length} Scenes • {durationSec}s Total ({totalDurationInFrames} frames @ 30fps)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-[11px]">
          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            <Layers className="w-3 h-3 text-indigo-400" />
            <span>2.5D Parallax</span>
          </span>
          <span className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
            <Volume2 className="w-3 h-3 text-amber-400" />
            <span>Ducking Audio</span>
          </span>
        </div>
      </div>

      {/* Main Player Display (9:16 Vertical Ratio Container) */}
      <div className="p-4 bg-black/60 flex flex-col items-center justify-center">
        <div
          className="relative w-full max-w-[340px] aspect-[9/16] rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-black flex items-center justify-center"
          style={{ maxHeight: '580px' }}
        >
          <Player<any, ManhwaRecapProps>
            component={ManhwaRecapComposition}
            inputProps={inputProps}
            durationInFrames={totalDurationInFrames}
            compositionWidth={1080}
            compositionHeight={1920}
            fps={30}
            style={{
              width: '100%',
              height: '100%',
            }}
            controls
            autoPlay={false}
            loop
          />
        </div>
      </div>

      {/* Player Footer & Motion Details */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span>
            Scrub timeline untuk menguji animasi kata per kata (Kinetic Captions), kedalaman parallax, dan efek transisi.
          </span>
        </div>
      </div>
    </div>
  );
};

export default RemotionPreviewPlayer;
