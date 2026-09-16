import React from 'react';
import { AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame } from 'remotion';
import { CameraMotion } from '../types';
import { ParallaxScene } from './ParallaxScene';

export interface MotionVideoSceneProps {
  videoUrl?: string;
  backgroundUrl: string;
  foregroundUrl?: string;
  cameraMotion?: CameraMotion;
  durationInFrames: number;
}

export const MotionVideoScene: React.FC<MotionVideoSceneProps> = ({
  videoUrl,
  backgroundUrl,
  foregroundUrl,
  cameraMotion = 'zoom_in',
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  // If no video clip provided, fallback to 2.5D Parallax layers
  if (!videoUrl) {
    return (
      <ParallaxScene
        backgroundUrl={backgroundUrl}
        foregroundUrl={foregroundUrl}
        cameraMotion={cameraMotion}
        durationInFrames={durationInFrames}
      />
    );
  }

  // Subtle cinematic zoom for video to enhance depth
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000', overflow: 'hidden' }}>
      {/* 1. Main Motion Video Clip (Vibes.ai I2V) */}
      <AbsoluteFill
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <OffthreadVideo
          src={videoUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* 2. Cinematic Vignette Overlay */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 3. Subtle bottom gradient for subtitle readability */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 30%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
