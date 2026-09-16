import React, { useMemo, useCallback } from 'react';
import { Audio, Sequence, useVideoConfig, interpolate, Easing } from 'remotion';
import { SceneItem } from '../types';

export interface AudioMasterTrackProps {
  scenes: SceneItem[];
  bgmUrl?: string;
  bgmBaseVolume?: number; // Base volume during silence (default 0.28)
  bgmDuckedVolume?: number; // Volume during active narration (default 0.10)
  sfxMap?: Record<string, string>;
}

const DEFAULT_SFX_MAP: Record<string, string> = {
  whoosh:
    'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/sfx/whoosh.mp3',
  sword_slash:
    'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/sfx/sword_slash.mp3',
  impact_boom:
    'https://yegyiqyqtcbvjjqxvyto.supabase.co/storage/v1/object/public/manhwa-assets/sfx/impact_boom.mp3',
};

export const AudioMasterTrack: React.FC<AudioMasterTrackProps> = ({
  scenes,
  bgmUrl,
  bgmBaseVolume = 0.28,
  bgmDuckedVolume = 0.10,
  sfxMap = DEFAULT_SFX_MAP,
}) => {
  const { fps, durationInFrames: totalFrames } = useVideoConfig();

  // Compute start frames for every scene
  const sceneTimeline = useMemo(() => {
    let currentFrame = 0;
    return scenes.map((scene) => {
      const startFrame = currentFrame;
      const durationFrames = Math.max(1, Math.round(scene.durationInSeconds * fps));
      currentFrame += durationFrames;
      return {
        scene,
        startFrame,
        durationFrames,
        endFrame: startFrame + durationFrames,
      };
    });
  }, [scenes, fps]);

  // Compute active speech intervals (with padding) for dynamic ducking
  const speechIntervals = useMemo(() => {
    const intervals: Array<{ start: number; end: number }> = [];

    sceneTimeline.forEach(({ scene, startFrame }) => {
      if (!scene.audioUrl) return;

      if (scene.wordTimestamps && scene.wordTimestamps.length > 0) {
        const firstWord = scene.wordTimestamps[0];
        const lastWord = scene.wordTimestamps[scene.wordTimestamps.length - 1];
        // 5 frames pre-ramp, 10 frames post-ramp
        const start = Math.max(0, startFrame + Math.round(firstWord.start * fps) - 5);
        const end = startFrame + Math.round(lastWord.end * fps) + 12;
        intervals.push({ start, end });
      } else {
        // Fallback: narration covers the whole scene
        const start = Math.max(0, startFrame);
        const end = startFrame + Math.round(scene.durationInSeconds * fps);
        intervals.push({ start, end });
      }
    });

    return intervals;
  }, [sceneTimeline, fps]);

  // Ducking function for BGM volume at frame f
  const calculateBgmVolume = useCallback(
    (f: number) => {
      // Intro fade in (frames 0 to 20)
      let masterGain = 1.0;
      if (f < 20) {
        masterGain = interpolate(f, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      }
      // Outro fade out (last 30 frames)
      if (f > totalFrames - 30) {
        masterGain = interpolate(f, [totalFrames - 30, totalFrames], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
      }

      // Check distance to any active speech interval
      let minDistanceToSpeech = 999999;
      let isInsideSpeech = false;

      for (const interval of speechIntervals) {
        if (f >= interval.start && f <= interval.end) {
          isInsideSpeech = true;
          break;
        }
        if (f < interval.start) {
          minDistanceToSpeech = Math.min(minDistanceToSpeech, interval.start - f);
        } else if (f > interval.end) {
          minDistanceToSpeech = Math.min(minDistanceToSpeech, f - interval.end);
        }
      }

      let currentVolume = bgmBaseVolume;
      if (isInsideSpeech) {
        currentVolume = bgmDuckedVolume;
      } else if (minDistanceToSpeech < 15) {
        // Smooth ducking transition over 15 frames
        currentVolume = interpolate(
          minDistanceToSpeech,
          [0, 15],
          [bgmDuckedVolume, bgmBaseVolume],
          {
            easing: Easing.bezier(0.25, 0.1, 0.25, 1.0),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }
        );
      }

      return currentVolume * masterGain;
    },
    [speechIntervals, bgmBaseVolume, bgmDuckedVolume, totalFrames]
  );

  return (
    <>
      {/* 1. Global Ambient BGM with Automatic Narration Ducking */}
      {bgmUrl && (
        <Audio
          src={bgmUrl}
          volume={calculateBgmVolume}
          loop
        />
      )}

      {/* 2. Scene Vocal Narrations & SFX Transitions */}
      {sceneTimeline.map(({ scene, startFrame, durationFrames }, idx) => {
        const sfxUrl =
          scene.sfxType && scene.sfxType !== 'none'
            ? sfxMap[scene.sfxType] || DEFAULT_SFX_MAP[scene.sfxType]
            : undefined;

        return (
          <React.Fragment key={scene.id || `audio-scene-${idx}`}>
            {/* Edge-TTS Narration Vocal */}
            {scene.audioUrl && (
              <Sequence
                from={startFrame}
                durationInFrames={durationFrames}
                name={`Vocal-${scene.id || idx}`}
              >
                <Audio src={scene.audioUrl} volume={1.0} />
              </Sequence>
            )}

            {/* Cinematic Transition SFX (Whoosh / Slash / Boom) */}
            {sfxUrl && (
              <Sequence
                from={startFrame}
                durationInFrames={Math.min(90, durationFrames)}
                name={`SFX-${scene.sfxType}-${scene.id || idx}`}
              >
                <Audio src={sfxUrl} volume={0.45} />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};
