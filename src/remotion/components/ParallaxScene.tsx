import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { CameraMotion } from '../types';

export interface ParallaxSceneProps {
  backgroundUrl: string;
  foregroundUrl?: string;
  cameraMotion?: CameraMotion;
  durationInFrames?: number;
  vignetteIntensity?: number;
}

export const ParallaxScene: React.FC<ParallaxSceneProps> = ({
  backgroundUrl,
  foregroundUrl,
  cameraMotion = 'zoom_in',
  durationInFrames: customDuration,
  vignetteIntensity = 0.75,
}) => {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const totalFrames = customDuration ?? videoConfig.durationInFrames;

  // Bezier smooth cinematic easing curve
  const cinematicEasing = useMemo(
    () => Easing.bezier(0.25, 0.1, 0.25, 1.0),
    []
  );

  // Background transformations based on camera motion
  const { bgScale, bgTranslateX, bgTranslateY } = useMemo(() => {
    switch (cameraMotion) {
      case 'zoom_in':
        return {
          bgScale: interpolate(frame, [0, totalFrames], [1.0, 1.15], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateX: 0,
          bgTranslateY: interpolate(frame, [0, totalFrames], [0, -10], {
            easing: cinematicEasing,
            extrapolateRight: 'clamp',
          }),
        };

      case 'zoom_out':
        return {
          bgScale: interpolate(frame, [0, totalFrames], [1.18, 1.02], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateX: 0,
          bgTranslateY: interpolate(frame, [0, totalFrames], [-15, 0], {
            easing: cinematicEasing,
            extrapolateRight: 'clamp',
          }),
        };

      case 'pan_left':
        return {
          bgScale: 1.12,
          bgTranslateX: interpolate(frame, [0, totalFrames], [25, -25], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateY: 0,
        };

      case 'pan_right':
        return {
          bgScale: 1.12,
          bgTranslateX: interpolate(frame, [0, totalFrames], [-25, 25], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateY: 0,
        };

      case 'tilt_up':
        return {
          bgScale: 1.12,
          bgTranslateX: 0,
          bgTranslateY: interpolate(frame, [0, totalFrames], [35, -25], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        };

      case 'action':
        return {
          bgScale: interpolate(frame, [0, totalFrames], [1.02, 1.22], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateX: interpolate(frame, [0, 10, 20, totalFrames], [0, -6, 4, 0], {
            extrapolateRight: 'clamp',
          }),
          bgTranslateY: interpolate(frame, [0, 10, 20, totalFrames], [0, 5, -3, 0], {
            extrapolateRight: 'clamp',
          }),
        };

      case 'static':
      default:
        return {
          bgScale: interpolate(frame, [0, totalFrames], [1.0, 1.04], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          bgTranslateX: 0,
          bgTranslateY: 0,
        };
    }
  }, [cameraMotion, frame, totalFrames, cinematicEasing]);

  // Foreground character transformations with 2.5D differential parallax
  const { fgScale, fgTranslateX, fgTranslateY } = useMemo(() => {
    switch (cameraMotion) {
      case 'zoom_in':
        return {
          fgScale: interpolate(frame, [0, totalFrames], [1.05, 1.28], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateX: 0,
          fgTranslateY: interpolate(frame, [0, totalFrames], [0, -35], {
            easing: cinematicEasing,
            extrapolateRight: 'clamp',
          }),
        };

      case 'zoom_out':
        return {
          fgScale: interpolate(frame, [0, totalFrames], [1.28, 1.05], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateX: 0,
          fgTranslateY: interpolate(frame, [0, totalFrames], [-35, 0], {
            easing: cinematicEasing,
            extrapolateRight: 'clamp',
          }),
        };

      case 'pan_left':
        return {
          fgScale: 1.18,
          fgTranslateX: interpolate(frame, [0, totalFrames], [70, -70], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateY: 0,
        };

      case 'pan_right':
        return {
          fgScale: 1.18,
          fgTranslateX: interpolate(frame, [0, totalFrames], [-70, 70], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateY: 0,
        };

      case 'tilt_up':
        return {
          fgScale: 1.18,
          fgTranslateX: 0,
          fgTranslateY: interpolate(frame, [0, totalFrames], [85, -60], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        };

      case 'action':
        return {
          fgScale: interpolate(frame, [0, totalFrames], [1.08, 1.35], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateX: interpolate(frame, [0, 8, 18, totalFrames], [0, -12, 8, 0], {
            extrapolateRight: 'clamp',
          }),
          fgTranslateY: interpolate(frame, [0, 8, 18, totalFrames], [0, 10, -6, 0], {
            extrapolateRight: 'clamp',
          }),
        };

      case 'static':
      default:
        return {
          fgScale: interpolate(frame, [0, totalFrames], [1.02, 1.08], {
            easing: cinematicEasing,
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          fgTranslateX: 0,
          fgTranslateY: interpolate(frame, [0, totalFrames], [0, -8], {
            easing: cinematicEasing,
            extrapolateRight: 'clamp',
          }),
        };
    }
  }, [cameraMotion, frame, totalFrames, cinematicEasing]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050508',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Background Environment */}
      <AbsoluteFill
        style={{
          transform: `scale(${bgScale}) translate3d(${bgTranslateX}px, ${bgTranslateY}px, 0)`,
          transformOrigin: 'center center',
          filter: foregroundUrl ? 'brightness(0.92) contrast(1.08)' : 'contrast(1.05)',
        }}
      >
        <Img
          src={backgroundUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </AbsoluteFill>

      {/* Layer 2: Transparent Character Cutout (2.5D Parallax Foreground) */}
      {foregroundUrl && (
        <AbsoluteFill
          style={{
            transform: `scale(${fgScale}) translate3d(${fgTranslateX}px, ${fgTranslateY}px, 0)`,
            transformOrigin: 'center bottom',
            filter: 'drop-shadow(0 20px 35px rgba(0,0,0,0.75))',
            pointerEvents: 'none',
          }}
        >
          <Img
            src={foregroundUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center bottom',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Layer 3: Cinematic Vignette Overlay */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, ${vignetteIntensity}) 100%)`,
        }}
      />

      {/* Layer 4: Top & Bottom Letterbox Shadow for Manhwa Drama & Subtitle Clarity */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 16%, transparent 75%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
