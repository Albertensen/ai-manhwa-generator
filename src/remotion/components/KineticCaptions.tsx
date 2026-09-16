import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';
import { WordCaption } from '../types';

export interface KineticCaptionsProps {
  narrationText: string;
  wordTimestamps?: WordCaption[];
  durationInFrames?: number;
}

interface ProcessedWord extends WordCaption {
  startFrame: number;
  endFrame: number;
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  narrationText,
  wordTimestamps,
  durationInFrames: customDuration,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: configDuration } = useVideoConfig();
  const totalFrames = customDuration ?? configDuration;
  const currentTime = frame / fps;

  // Ensure we have word-level boundaries. If absent, interpolate evenly.
  const processedWords: ProcessedWord[] = useMemo(() => {
    if (wordTimestamps && wordTimestamps.length > 0) {
      return wordTimestamps.map((w) => ({
        ...w,
        startFrame: Math.round(w.start * fps),
        endFrame: Math.round(w.end * fps),
      }));
    }

    // Fallback: split narrationText into words evenly
    const words = narrationText.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];

    const totalSec = totalFrames / fps;
    const wordDuration = totalSec / words.length;

    return words.map((word, i) => {
      const start = i * wordDuration;
      const end = (i + 1) * wordDuration;
      return {
        text: word,
        start,
        end,
        startFrame: Math.round(start * fps),
        endFrame: Math.round(end * fps),
      };
    });
  }, [narrationText, wordTimestamps, fps, totalFrames]);

  // Group words into phrases (chunks of 4-6 words) for high-impact readability
  const phraseChunks = useMemo(() => {
    const CHUNK_SIZE = 5;
    const chunks: ProcessedWord[][] = [];
    for (let i = 0; i < processedWords.length; i += CHUNK_SIZE) {
      chunks.push(processedWords.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [processedWords]);

  // Find the currently active phrase chunk
  const activeChunk = useMemo(() => {
    if (phraseChunks.length === 0) return [];
    for (const chunk of phraseChunks) {
      const firstWord = chunk[0];
      const lastWord = chunk[chunk.length - 1];
      if (currentTime >= firstWord.start && currentTime <= lastWord.end + 0.3) {
        return chunk;
      }
    }
    // Default to nearest chunk
    if (currentTime < phraseChunks[0][0].start) {
      return phraseChunks[0];
    }
    return phraseChunks[phraseChunks.length - 1];
  }, [phraseChunks, currentTime]);

  if (activeChunk.length === 0) return null;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 220,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px 16px',
          maxWidth: '85%',
          backgroundColor: 'rgba(5, 5, 10, 0.65)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          padding: '16px 32px',
          borderRadius: 24,
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.8)',
        }}
      >
        {activeChunk.map((word, idx) => {
          const isCurrentlySpoken =
            frame >= word.startFrame && frame <= word.endFrame + 2;
          const hasBeenSpoken = frame > word.endFrame + 2;

          // Spring pop-up for the active spoken word
          const springProgress = spring({
            frame: frame - word.startFrame,
            fps,
            config: {
              damping: 12,
              stiffness: 220,
              mass: 0.7,
            },
          });

          const scale = isCurrentlySpoken ? 1.0 + springProgress * 0.18 : 1.0;

          return (
            <span
              key={`${word.text}-${word.startFrame}-${idx}`}
              style={{
                fontFamily:
                  'Impact, "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                transform: `scale(${scale})`,
                display: 'inline-block',
                transition: 'transform 0.08s ease-out',
                color: isCurrentlySpoken
                  ? '#FFE600'
                  : hasBeenSpoken
                  ? '#FFFFFF'
                  : 'rgba(255, 255, 255, 0.45)',
                textShadow: isCurrentlySpoken
                  ? '0 0 20px rgba(255, 230, 0, 0.9), 0 0 35px rgba(255, 180, 0, 0.6), 0 4px 10px #000000'
                  : '0 4px 12px rgba(0, 0, 0, 0.9)',
                WebkitTextStroke: isCurrentlySpoken
                  ? '3px #000000'
                  : '2px #000000',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
