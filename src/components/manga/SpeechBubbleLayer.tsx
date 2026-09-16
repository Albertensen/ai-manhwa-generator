'use client';

import React from 'react';
import { Group, Rect, Ellipse, Text, Path, Circle, Line } from 'react-konva';
import { SpeechBubbleData, BubbleType } from '@/lib/manga-types';

interface SpeechBubbleLayerProps {
  bubbles: SpeechBubbleData[];
  selectedBubbleId: string | null;
  onSelectBubble: (id: string | null) => void;
  onUpdateBubble: (id: string, updates: Partial<SpeechBubbleData>) => void;
}

// Generates an explosive jagged spiky path for shout bubbles
function generateShoutPath(w: number, h: number): string {
  const points = 16;
  const rx = w / 2;
  const ry = h / 2;
  const cx = rx;
  const cy = ry;
  let d = '';

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // Alternate between outer spike and inner valley
    const spikeDist = i % 2 === 0 ? 1.25 : 0.85;
    const px = cx + Math.cos(angle) * rx * spikeDist;
    const py = cy + Math.sin(angle) * ry * spikeDist;
    if (i === 0) {
      d += `M ${px.toFixed(1)} ${py.toFixed(1)} `;
    } else {
      d += `L ${px.toFixed(1)} ${py.toFixed(1)} `;
    }
  }
  d += 'Z';
  return d;
}

export default function SpeechBubbleLayer({
  bubbles,
  selectedBubbleId,
  onSelectBubble,
  onUpdateBubble,
}: SpeechBubbleLayerProps) {
  return (
    <Group>
      {bubbles.map((bubble) => {
        const isSelected = selectedBubbleId === bubble.id;
        const w = bubble.width || 180;
        const h = bubble.height || 90;
        const tailX = bubble.tailX ?? 20;
        const tailY = bubble.tailY ?? (h + 30);

        return (
          <Group
            key={bubble.id}
            x={bubble.x}
            y={bubble.y}
            draggable
            onClick={(e) => {
              e.cancelBubble = true;
              onSelectBubble(bubble.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onSelectBubble(bubble.id);
            }}
            onDragEnd={(e) => {
              onUpdateBubble(bubble.id, {
                x: Math.round(e.target.x()),
                y: Math.round(e.target.y()),
              });
            }}
          >
            {/* 1. Tail Shape */}
            {bubble.type === 'thought' ? (
              // Thought Bubble trail circles
              <Group>
                <Circle
                  x={w / 2 + (tailX - w / 2) * 0.4}
                  y={h / 2 + (tailY - h / 2) * 0.4}
                  radius={7}
                  fill={bubble.bgColor || '#ffffff'}
                  stroke={bubble.borderColor || '#000000'}
                  strokeWidth={2}
                />
                <Circle
                  x={w / 2 + (tailX - w / 2) * 0.75}
                  y={h / 2 + (tailY - h / 2) * 0.75}
                  radius={4.5}
                  fill={bubble.bgColor || '#ffffff'}
                  stroke={bubble.borderColor || '#000000'}
                  strokeWidth={2}
                />
                <Circle
                  x={tailX}
                  y={tailY}
                  radius={2.5}
                  fill={bubble.bgColor || '#ffffff'}
                  stroke={bubble.borderColor || '#000000'}
                  strokeWidth={1.5}
                />
              </Group>
            ) : bubble.type === 'shout' ? (
              // Spiky shout has no standard tail or jagged triangular point
              <Line
                points={[w / 2 - 15, h - 5, tailX, tailY, w / 2 + 15, h - 5]}
                closed
                fill={bubble.bgColor || '#ffffff'}
                stroke={bubble.borderColor || '#000000'}
                strokeWidth={2.5}
              />
            ) : (
              // Standard Directional Pointer Tail
              <Line
                points={[w / 2 - 12, h / 2 + 20, tailX, tailY, w / 2 + 12, h / 2 + 15]}
                closed
                fill={bubble.bgColor || '#ffffff'}
                stroke={bubble.borderColor || '#000000'}
                strokeWidth={2}
              />
            )}

            {/* 2. Main Bubble Body */}
            {bubble.type === 'shout' ? (
              <Path
                data={generateShoutPath(w, h)}
                fill={bubble.bgColor || '#ffffff'}
                stroke={isSelected ? '#e11d48' : (bubble.borderColor || '#000000')}
                strokeWidth={isSelected ? 3.5 : 2.5}
                shadowColor="rgba(0,0,0,0.3)"
                shadowBlur={isSelected ? 10 : 4}
                shadowOffset={{ x: 2, y: 3 }}
              />
            ) : bubble.type === 'thought' ? (
              <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                cornerRadius={[35, 35, 35, 35]}
                fill={bubble.bgColor || '#ffffff'}
                stroke={isSelected ? '#6366f1' : (bubble.borderColor || '#000000')}
                strokeWidth={isSelected ? 3 : 2}
                shadowColor="rgba(0,0,0,0.2)"
                shadowBlur={6}
                shadowOffset={{ x: 2, y: 2 }}
              />
            ) : bubble.type === 'whisper' ? (
              <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                cornerRadius={[22, 22, 22, 22]}
                fill={bubble.bgColor || '#ffffff'}
                stroke={isSelected ? '#6366f1' : (bubble.borderColor || '#475569')}
                strokeWidth={2}
                dash={[6, 4]}
                shadowColor="rgba(0,0,0,0.15)"
                shadowBlur={4}
              />
            ) : (
              // Standard Oval / Rounded Bubble
              <Rect
                x={0}
                y={0}
                width={w}
                height={h}
                cornerRadius={[28, 28, 28, 28]}
                fill={bubble.bgColor || '#ffffff'}
                stroke={isSelected ? '#6366f1' : (bubble.borderColor || '#000000')}
                strokeWidth={isSelected ? 3 : 2}
                shadowColor="rgba(0,0,0,0.25)"
                shadowBlur={isSelected ? 8 : 3}
                shadowOffset={{ x: 2, y: 2 }}
              />
            )}

            {/* Speaker Tag (if any) */}
            {bubble.speaker && (
              <Group x={12} y={-10}>
                <Rect
                  width={bubble.speaker.length * 7 + 16}
                  height={18}
                  cornerRadius={9}
                  fill="#1e1b4b"
                  stroke="#6366f1"
                  strokeWidth={1}
                />
                <Text
                  x={8}
                  y={4}
                  text={bubble.speaker}
                  fontSize={10}
                  fontStyle="bold"
                  fill="#c7d2fe"
                />
              </Group>
            )}

            {/* 3. Bubble Dialogue Text */}
            <Text
              x={14}
              y={14}
              width={w - 28}
              height={h - 28}
              text={bubble.text || '...'}
              fontSize={bubble.fontSize || 13}
              fontFamily="system-ui, -apple-system, sans-serif"
              fontStyle={bubble.type === 'shout' ? 'bold' : 'normal'}
              fill={bubble.textColor || '#0f172a'}
              align="center"
              verticalAlign="middle"
              wrap="word"
              lineHeight={1.25}
            />

            {/* Selection Bounding indicator */}
            {isSelected && (
              <Rect
                x={-6}
                y={-6}
                width={w + 12}
                height={h + 12}
                stroke="#6366f1"
                strokeWidth={1.5}
                dash={[4, 3]}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
