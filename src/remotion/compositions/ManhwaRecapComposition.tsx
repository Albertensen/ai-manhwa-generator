import React from 'react';
import { AbsoluteFill, Series, useVideoConfig } from 'remotion';
import { ManhwaRecapProps } from '../types';
import { MotionVideoScene } from '../components/MotionVideoScene';
import { KineticCaptions } from '../components/KineticCaptions';
import { AudioMasterTrack } from '../components/AudioMasterTrack';

export const ManhwaRecapComposition: React.FC<ManhwaRecapProps> = ({
  scenes = [],
  bgmUrl,
  bgmVolume = 0.28,
}) => {
  const { fps } = useVideoConfig();

  if (!scenes || scenes.length === 0) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a10',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#ffffff',
          fontFamily: 'sans-serif',
          fontSize: 32,
        }}
      >
        Tidak ada adegan untuk dirender.
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* 1. Visual Series (Vibes.ai Motion / Parallax 2.5D + Kinetic Captions per scene) */}
      <Series>
        {scenes.map((scene, idx) => {
          const durationFrames = Math.max(
            1,
            Math.round(scene.durationInSeconds * fps)
          );

          return (
            <Series.Sequence
              key={scene.id || `series-seq-${idx}`}
              durationInFrames={durationFrames}
              name={`Scene-${scene.sceneOrder || idx + 1}`}
            >
              <MotionVideoScene
                videoUrl={scene.videoUrl}
                backgroundUrl={scene.backgroundUrl}
                foregroundUrl={scene.foregroundUrl}
                cameraMotion={scene.cameraMotion}
                durationInFrames={durationFrames}
              />
              <KineticCaptions
                narrationText={scene.narrationText}
                wordTimestamps={scene.wordTimestamps}
                durationInFrames={durationFrames}
              />
            </Series.Sequence>
          );
        })}
      </Series>

      {/* 2. Audio Master Track (TTS Narration + Transition SFX + Ducked BGM) */}
      <AudioMasterTrack
        scenes={scenes}
        bgmUrl={bgmUrl}
        bgmBaseVolume={bgmVolume}
        bgmDuckedVolume={0.10}
      />
    </AbsoluteFill>
  );
};
