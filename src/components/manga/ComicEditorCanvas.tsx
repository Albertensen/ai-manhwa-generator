'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Text, Group, Image as KonvaImage, Transformer } from 'react-konva';
import SpeechBubbleLayer from './SpeechBubbleLayer';
import {
  MangaPageData,
  MangaPanelData,
  SpeechBubbleData,
  SfxStickerData,
  ComicLayoutType,
  BubbleType
} from '@/lib/manga-types';
import {
  Layout,
  MessageSquare,
  Sparkles,
  Download,
  Trash2,
  Plus,
  Sliders,
  Palette,
  Image as ImageIcon,
  RotateCw,
  Film
} from 'lucide-react';

interface ComicEditorCanvasProps {
  page: MangaPageData;
  onUpdatePage: (updated: MangaPageData) => void;
  onGoToMotionRecap: () => void;
}

// Custom Image Component for Konva Canvas with crossOrigin safety
function PanelImage({
  imageUrl,
  x,
  y,
  width,
  height,
}: {
  imageUrl?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setImageObj(null);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => setImageObj(img);
  }, [imageUrl]);

  if (!imageObj) {
    return (
      <Group x={x} y={y}>
        <Rect
          width={width}
          height={height}
          fill="#1e293b"
          stroke="#334155"
          strokeWidth={1}
        />
        <Text
          x={10}
          y={height / 2 - 16}
          width={width - 20}
          text="Drop / Upload Panel Image"
          fontSize={12}
          fill="#64748b"
          align="center"
        />
      </Group>
    );
  }

  // Cover calculation
  const imgRatio = imageObj.width / imageObj.height;
  const slotRatio = width / height;
  let renderW = width;
  let renderH = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > slotRatio) {
    renderW = height * imgRatio;
    offsetX = (renderW - width) / 2;
  } else {
    renderH = width / imgRatio;
    offsetY = (renderH - height) / 2;
  }

  return (
    <Group
      x={x}
      y={y}
      clipFunc={(ctx) => {
        ctx.rect(0, 0, width, height);
      }}
    >
      <KonvaImage
        image={imageObj}
        x={-offsetX}
        y={-offsetY}
        width={renderW}
        height={renderH}
      />
    </Group>
  );
}

// Preset Layout Generator
export function generateLayoutPanels(
  type: ComicLayoutType,
  canvasW: number,
  canvasH: number,
  gutter: number
): MangaPanelData[] {
  const pad = 24;
  const innerW = canvasW - pad * 2;
  const innerH = canvasH - pad * 2;

  if (type === 'webtoon') {
    // 3 Stacked vertical webtoon panels
    const panelCount = 3;
    const totalGutters = (panelCount - 1) * gutter;
    const panelH = (innerH - totalGutters) / panelCount;

    return [
      {
        id: 'panel_1',
        panelNumber: 1,
        label: 'Panel 1: Establishing Shot',
        x: pad,
        y: pad,
        width: innerW,
        height: panelH,
        visualPrompt: 'Wide panoramic establishing shot of dark dungeon gate',
        dialogue: 'Di tengah kegelapan labirin bawah tanah, sebuah gerbang kuno terbuka...',
        speaker: 'Kaelen'
      },
      {
        id: 'panel_2',
        panelNumber: 2,
        label: 'Panel 2: Tension & Focus',
        x: pad,
        y: pad + panelH + gutter,
        width: innerW,
        height: panelH,
        visualPrompt: 'Close up eye reflection, glowing blue aura',
        dialogue: 'Apakah ini batas kekuatanku? Tidak... ini baru permulaan.',
        speaker: 'Kaelen'
      },
      {
        id: 'panel_3',
        panelNumber: 3,
        label: 'Panel 3: Climax / Action',
        x: pad,
        y: pad + (panelH + gutter) * 2,
        width: innerW,
        height: panelH,
        visualPrompt: 'Dynamic attack swing with shockwave effects',
        dialogue: 'Bangkitlah, Pasukan Bayangan!',
        speaker: 'Kaelen',
        sfxPrompt: 'SLASH!!'
      },
    ];
  }

  if (type === 'action') {
    // Action Slanted 4-Panel (Top wide, 2 diagonal middle splits, bottom wide)
    const topH = innerH * 0.28;
    const midH = innerH * 0.42;
    const botH = innerH - topH - midH - gutter * 2;
    const halfW = (innerW - gutter) / 2;

    return [
      {
        id: 'panel_1',
        panelNumber: 1,
        label: 'Panel 1: Sky / Ambush',
        x: pad,
        y: pad,
        width: innerW,
        height: topH,
        visualPrompt: 'High angle view of monster horde descending',
        dialogue: 'Musuh mendekat dari segala arah!',
        speaker: 'Seraphina'
      },
      {
        id: 'panel_2',
        panelNumber: 2,
        label: 'Panel 2: Hero Strike (Slanted Left)',
        x: pad,
        y: pad + topH + gutter,
        width: halfW,
        height: midH,
        visualPrompt: 'Hero unsheathing black blade with fierce motion blur',
        dialogue: 'Jangan biarkan mereka lolos!',
        speaker: 'Kaelen'
      },
      {
        id: 'panel_3',
        panelNumber: 3,
        label: 'Panel 3: Counter-Attack (Slanted Right)',
        x: pad + halfW + gutter,
        y: pad + topH + gutter,
        width: halfW,
        height: midH,
        visualPrompt: 'Villain roaring with demonic red lightning',
        dialogue: 'Mati kau, manusia lemah!',
        speaker: 'Demon Lord',
        sfxPrompt: 'CRASH!!'
      },
      {
        id: 'panel_4',
        panelNumber: 4,
        label: 'Panel 4: Collision / Impact',
        x: pad,
        y: pad + topH + midH + gutter * 2,
        width: innerW,
        height: botH,
        visualPrompt: 'Massive explosion clash of blue and red mana',
        dialogue: 'DUMMMM!!',
        speaker: 'Narrator',
        sfxPrompt: 'DUMMM!'
      }
    ];
  }

  // Classic Manga Grid (4 panels: 2x2)
  const colW = (innerW - gutter) / 2;
  const rowH = (innerH - gutter) / 2;

  return [
    {
      id: 'panel_1',
      panelNumber: 1,
      label: 'Panel 1: Top Left',
      x: pad,
      y: pad,
      width: colW,
      height: rowH,
      visualPrompt: 'Character looking intently at the ancient scroll',
      dialogue: 'Peta ini... mengarah ke makam raja iblis.',
      speaker: 'Kaelen'
    },
    {
      id: 'panel_2',
      panelNumber: 2,
      label: 'Panel 2: Top Right',
      x: pad + colW + gutter,
      y: pad,
      width: colW,
      height: rowH,
      visualPrompt: 'Heroine stepping forward with warning gesture',
      dialogue: 'Terlalu berbahaya untuk pergi sendirian.',
      speaker: 'Seraphina'
    },
    {
      id: 'panel_3',
      panelNumber: 3,
      label: 'Panel 3: Bottom Left',
      x: pad,
      y: pad + rowH + gutter,
      width: colW,
      height: rowH,
      visualPrompt: 'Shadows extending from hero footsteps',
      dialogue: 'Aku tidak akan pernah mundur lagi.',
      speaker: 'Kaelen'
    },
    {
      id: 'panel_4',
      panelNumber: 4,
      label: 'Panel 4: Bottom Right',
      x: pad + colW + gutter,
      y: pad + rowH + gutter,
      width: colW,
      height: rowH,
      visualPrompt: 'Eyes blazing with blue fire',
      dialogue: 'Mari kita selesaikan ini!',
      speaker: 'Kaelen',
      sfxPrompt: 'BOOM!'
    }
  ];
}

export default function ComicEditorCanvas({
  page,
  onUpdatePage,
  onGoToMotionRecap,
}: ComicEditorCanvasProps) {
  const stageRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetPanelId, setTargetPanelId] = useState<string | null>(null);

  // Selection states
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const [selectedSfxId, setSelectedSfxId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'layout' | 'bubble' | 'sfx' | 'settings'>('layout');

  // Canvas Dimensions
  const canvasW = page.canvasWidth || 720;
  const canvasH = page.canvasHeight || 1080;

  // Selected Bubble Data
  const currentBubble = page.bubbles.find((b) => b.id === selectedBubbleId);

  // Layout switcher
  const handleSwitchLayout = (layoutType: ComicLayoutType) => {
    const newPanels = generateLayoutPanels(layoutType, canvasW, canvasH, page.gutterSize || 12);
    // Keep existing images if any
    const mergedPanels = newPanels.map((np, idx) => {
      const existing = page.panels[idx];
      return {
        ...np,
        imageUrl: existing?.imageUrl || null,
      };
    });

    // Generate speech bubbles matching the panels if none exist
    const newBubbles: SpeechBubbleData[] = mergedPanels.map((p, idx) => ({
      id: `bubble_${Date.now()}_${idx}`,
      panelId: p.id,
      type: idx === 2 ? 'shout' : 'oval',
      x: p.x + 30,
      y: p.y + 25,
      width: 190,
      height: 85,
      tailX: 25,
      tailY: 110,
      text: p.dialogue,
      speaker: p.speaker,
      fontSize: 12,
      textColor: '#0f172a',
      bgColor: '#ffffff',
      borderColor: '#000000',
    }));

    onUpdatePage({
      ...page,
      layout: layoutType,
      panels: mergedPanels,
      bubbles: newBubbles,
    });
  };

  // Gutter changer
  const handleChangeGutter = (val: number) => {
    const updatedPanels = generateLayoutPanels(page.layout, canvasW, canvasH, val).map((np, idx) => ({
      ...np,
      imageUrl: page.panels[idx]?.imageUrl || null,
    }));
    onUpdatePage({
      ...page,
      gutterSize: val,
      panels: updatedPanels,
    });
  };

  // Background changer
  const handleChangeBg = (color: string) => {
    onUpdatePage({
      ...page,
      backgroundColor: color,
    });
  };

  // Add Speech Bubble
  const handleAddBubble = (type: BubbleType = 'oval') => {
    const newId = `bubble_${Date.now()}`;
    const newBubble: SpeechBubbleData = {
      id: newId,
      type,
      x: canvasW / 2 - 90,
      y: canvasH / 2 - 45,
      width: 190,
      height: 85,
      tailX: 25,
      tailY: 110,
      text: type === 'shout' ? 'TERIMA INI!!' : 'Dialog komik baru...',
      fontSize: 13,
      textColor: '#0f172a',
      bgColor: '#ffffff',
      borderColor: '#000000',
    };

    onUpdatePage({
      ...page,
      bubbles: [...page.bubbles, newBubble],
    });
    setSelectedBubbleId(newId);
  };

  // Update Speech Bubble
  const handleUpdateBubble = (id: string, updates: Partial<SpeechBubbleData>) => {
    const updated = page.bubbles.map((b) => (b.id === id ? { ...b, ...updates } : b));
    onUpdatePage({
      ...page,
      bubbles: updated,
    });
  };

  // Delete Speech Bubble
  const handleDeleteBubble = (id: string) => {
    onUpdatePage({
      ...page,
      bubbles: page.bubbles.filter((b) => b.id !== id),
    });
    if (selectedBubbleId === id) setSelectedBubbleId(null);
  };

  // Add Onomatopoeia SFX Sticker
  const handleAddSfx = (text: string, stylePreset: 'slash' | 'impact' | 'magic' | 'scream' = 'slash') => {
    const newId = `sfx_${Date.now()}`;
    const colorMap = {
      slash: '#e11d48', // Red
      impact: '#f59e0b', // Gold
      magic: '#06b6d4', // Cyan
      scream: '#a855f7', // Purple
    };

    const newSfx: SfxStickerData = {
      id: newId,
      text,
      x: canvasW / 2 - 60,
      y: canvasH / 2 - 30,
      rotation: Math.floor(Math.random() * 20) - 10,
      fontSize: 36,
      color: colorMap[stylePreset],
      strokeColor: '#000000',
      stylePreset,
    };

    onUpdatePage({
      ...page,
      sfxStickers: [...page.sfxStickers, newSfx],
    });
    setSelectedSfxId(newId);
  };

  // Delete SFX
  const handleDeleteSfx = (id: string) => {
    onUpdatePage({
      ...page,
      sfxStickers: page.sfxStickers.filter((s) => s.id !== id),
    });
    if (selectedSfxId === id) setSelectedSfxId(null);
  };

  // Trigger Panel Image Upload
  const handleSlotImageClick = (panelId: string) => {
    setTargetPanelId(panelId);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && targetPanelId) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const updatedPanels = page.panels.map((p) =>
          p.id === targetPanelId ? { ...p, imageUrl: dataUrl } : p
        );
        onUpdatePage({
          ...page,
          panels: updatedPanels,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Export High-Res PNG
  const handleExportPng = () => {
    if (!stageRef.current) return;
    setSelectedBubbleId(null);
    setSelectedSfxId(null);

    // Wait a tick for selection bounds to clear
    setTimeout(() => {
      const dataUri = stageRef.current.toDataURL({ pixelRatio: 2 });
      const a = document.createElement('a');
      a.download = `manhwa_page_${page.pageNumber || 1}_${Date.now()}.png`;
      a.href = dataUri;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 50);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* Left / Center: Interactive Comic Canvas */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col items-center w-full">
        {/* Canvas Toolbar Header */}
        <div className="w-full max-w-[720px] mb-3 flex items-center justify-between px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-300">
              Page {page.pageNumber || 1} • {page.layout.toUpperCase()}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
              {canvasW} x {canvasH} px
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportPng}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-sm"
              title="Export High-Res Comic Page PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PNG (Print HQ)</span>
            </button>

            <button
              type="button"
              onClick={onGoToMotionRecap}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-xs font-bold text-white transition shadow-sm"
              title="Animate this page to Remotion Recap"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Animate to Recap</span>
            </button>
          </div>
        </div>

        {/* The Konva Canvas Box */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700/80"
          style={{ width: canvasW, height: canvasH, backgroundColor: page.backgroundColor || '#0f172a' }}
        >
          <Stage
            ref={stageRef}
            width={canvasW}
            height={canvasH}
            onClick={() => {
              setSelectedBubbleId(null);
              setSelectedSfxId(null);
            }}
          >
            {/* Background Layer */}
            <Layer>
              <Rect
                x={0}
                y={0}
                width={canvasW}
                height={canvasH}
                fill={page.backgroundColor || '#0f172a'}
              />
            </Layer>

            {/* Panels Layer */}
            <Layer>
              {page.panels.map((panel) => (
                <Group key={panel.id}>
                  {/* Panel Image Slot */}
                  <PanelImage
                    imageUrl={panel.imageUrl}
                    x={panel.x}
                    y={panel.y}
                    width={panel.width}
                    height={panel.height}
                  />

                  {/* Panel Border Frame */}
                  <Rect
                    x={panel.x}
                    y={panel.y}
                    width={panel.width}
                    height={panel.height}
                    stroke={page.backgroundColor === '#ffffff' ? '#000000' : '#334155'}
                    strokeWidth={2}
                  />

                  {/* Panel Number Badge */}
                  <Group x={panel.x + 6} y={panel.y + 6}>
                    <Rect
                      width={20}
                      height={18}
                      cornerRadius={3}
                      fill="rgba(0,0,0,0.75)"
                    />
                    <Text
                      x={6}
                      y={4}
                      text={panel.panelNumber.toString()}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#f8fafc"
                    />
                  </Group>
                </Group>
              ))}
            </Layer>

            {/* Onomatopoeia SFX Layer */}
            <Layer>
              {page.sfxStickers.map((sfx) => {
                const isSelected = selectedSfxId === sfx.id;
                return (
                  <Group
                    key={sfx.id}
                    x={sfx.x}
                    y={sfx.y}
                    rotation={sfx.rotation}
                    draggable
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedSfxId(sfx.id);
                      setSelectedBubbleId(null);
                    }}
                    onDragEnd={(e) => {
                      const updated = page.sfxStickers.map((s) =>
                        s.id === sfx.id ? { ...s, x: e.target.x(), y: e.target.y() } : s
                      );
                      onUpdatePage({ ...page, sfxStickers: updated });
                    }}
                  >
                    <Text
                      text={sfx.text}
                      fontSize={sfx.fontSize}
                      fontStyle="900"
                      fontFamily="Impact, sans-serif"
                      fill={sfx.color}
                      stroke={sfx.strokeColor}
                      strokeWidth={4}
                      shadowColor="rgba(0,0,0,0.6)"
                      shadowBlur={8}
                      shadowOffset={{ x: 3, y: 3 }}
                    />
                    {isSelected && (
                      <Rect
                        x={-6}
                        y={-6}
                        width={sfx.text.length * (sfx.fontSize * 0.6) + 12}
                        height={sfx.fontSize + 12}
                        stroke="#e11d48"
                        strokeWidth={1.5}
                        dash={[4, 3]}
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>

            {/* Speech Bubbles Layer */}
            <Layer>
              <SpeechBubbleLayer
                bubbles={page.bubbles}
                selectedBubbleId={selectedBubbleId}
                onSelectBubble={(id) => {
                  setSelectedBubbleId(id);
                  setSelectedSfxId(null);
                }}
                onUpdateBubble={handleUpdateBubble}
              />
            </Layer>
          </Stage>

          {/* Overlay Buttons for quick Panel Image replacement */}
          <div className="absolute inset-0 pointer-events-none">
            {page.panels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSlotImageClick(p.id)}
                className="pointer-events-auto absolute px-2.5 py-1 rounded bg-slate-900/80 hover:bg-slate-800 text-[10px] font-bold text-slate-200 border border-slate-700 transition flex items-center space-x-1 backdrop-blur-sm shadow"
                style={{
                  top: p.y + p.height - 30,
                  right: canvasW - (p.x + p.width) + 8,
                }}
              >
                <ImageIcon className="w-3 h-3 text-indigo-400" />
                <span>{p.imageUrl ? 'Ganti Foto' : '+ Pasang Panel'}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Right Sidebar: MangaFlow Studio Tools & Properties */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-80 flex flex-col space-y-4">
        {/* Tool Navigation Tabs */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          {[
            { id: 'layout', label: 'Layout', icon: Layout },
            { id: 'bubble', label: 'Bubbles', icon: MessageSquare },
            { id: 'sfx', label: 'SFX', icon: Sparkles },
            { id: 'settings', label: 'Canvas', icon: Sliders },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTool(t.id as any)}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[11px] font-bold transition ${
                  activeTool === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 mb-1" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Layout Selection */}
        {activeTool === 'layout' && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Comic Page Templates
            </h3>
            <div className="space-y-2.5">
              {[
                {
                  id: 'webtoon',
                  name: 'Webtoon Vertical Scroll',
                  desc: '3 Panel bertumpuk vertikal ideal untuk smartphone manhwa.',
                  tag: 'POPULAR'
                },
                {
                  id: 'action',
                  name: 'Action Slanted 4-Panel',
                  desc: 'Split sudut diagonal dinamis untuk adegan pertarungan epik.',
                  tag: 'ACTION'
                },
                {
                  id: 'classic',
                  name: 'Classic Manga Grid (2x2)',
                  desc: '4 Panel terstruktur klasik ala manga Shonen Jump.',
                  tag: 'MANGA'
                },
              ].map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSwitchLayout(tmpl.id as ComicLayoutType)}
                  className={`p-3 rounded-xl border cursor-pointer transition ${
                    page.layout === tmpl.id
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{tmpl.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      {tmpl.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{tmpl.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Speech Bubbles Tool */}
        {activeTool === 'bubble' && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Speech Bubble Tool
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {page.bubbles.length} Bubbles
              </span>
            </div>

            {/* Add Bubble Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleAddBubble('oval')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>+ Oval Bubble</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBubble('shout')}
                className="px-3 py-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-xs font-bold text-rose-300 border border-rose-800/40 transition flex items-center justify-center space-x-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                <span>+ Spiky Shout</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBubble('thought')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Thought</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddBubble('whisper')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition flex items-center justify-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5 text-sky-400" />
                <span>+ Whisper</span>
              </button>
            </div>

            {/* Bubble Inspector when selected */}
            {currentBubble ? (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-indigo-300 uppercase">
                    Edit Balon Terpilih
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteBubble(currentBubble.id)}
                    className="p-1 rounded hover:bg-rose-950 text-rose-400"
                    title="Hapus Balon"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">
                    Teks Dialog
                  </label>
                  <textarea
                    rows={3}
                    value={currentBubble.text}
                    onChange={(e) => handleUpdateBubble(currentBubble.id, { text: e.target.value })}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase">
                      Karakter / Tokoh
                    </label>
                    <input
                      type="text"
                      value={currentBubble.speaker || ''}
                      onChange={(e) =>
                        handleUpdateBubble(currentBubble.id, { speaker: e.target.value })
                      }
                      placeholder="Contoh: Kaelen"
                      className="w-full mt-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase">
                      Ukuran Huruf ({currentBubble.fontSize}px)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      value={currentBubble.fontSize}
                      onChange={(e) =>
                        handleUpdateBubble(currentBubble.id, { fontSize: Number(e.target.value) })
                      }
                      className="w-full mt-2"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  {(['oval', 'shout', 'thought', 'whisper'] as BubbleType[]).map((bt) => (
                    <button
                      key={bt}
                      type="button"
                      onClick={() => handleUpdateBubble(currentBubble.id, { type: bt })}
                      className={`flex-1 py-1 rounded text-[10px] font-bold capitalize transition ${
                        currentBubble.type === bt
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic text-center py-2">
                Klik salah satu balon di atas kanvas untuk mengedit teks atau gaya.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: Onomatopoeia SFX Tool */}
        {activeTool === 'sfx' && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Manga SFX / Sound Effects
              </h3>
              <span className="text-[10px] font-mono text-slate-400">
                {page.sfxStickers.length} SFX
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Klik stiker onomatopoeia untuk menambahkan teks efek aksi ke kanvas komik:
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[
                { text: 'SLASH!!', style: 'slash', color: 'bg-rose-950 text-rose-300 border-rose-800' },
                { text: 'DUMMM!', style: 'impact', color: 'bg-amber-950 text-amber-300 border-amber-800' },
                { text: 'CRASH!', style: 'impact', color: 'bg-orange-950 text-orange-300 border-orange-800' },
                { text: 'BOOOOM!', style: 'impact', color: 'bg-red-950 text-red-300 border-red-800' },
                { text: 'WHISH!', style: 'magic', color: 'bg-cyan-950 text-cyan-300 border-cyan-800' },
                { text: 'ZAAAP!', style: 'magic', color: 'bg-sky-950 text-sky-300 border-sky-800' },
                { text: 'KABOOM!', style: 'scream', color: 'bg-purple-950 text-purple-300 border-purple-800' },
                { text: 'HYAAAH!', style: 'scream', color: 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-800' },
              ].map((s) => (
                <button
                  key={s.text}
                  type="button"
                  onClick={() => handleAddSfx(s.text, s.style as any)}
                  className={`p-2.5 rounded-lg border text-center font-black font-mono tracking-wider text-xs transition hover:scale-105 active:scale-95 ${s.color}`}
                >
                  {s.text}
                </button>
              ))}
            </div>

            {selectedSfxId && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-rose-400 font-bold">SFX Terpilih</span>
                <button
                  type="button"
                  onClick={() => handleDeleteSfx(selectedSfxId)}
                  className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-rose-900/60 hover:bg-rose-900 text-[11px] font-bold text-rose-200"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus SFX</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Canvas Settings */}
        {activeTool === 'settings' && (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Canvas Styling &amp; Gutters
            </h3>

            {/* Gutters Slider */}
            <div>
              <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                <span>Ketebalan Gutter (Garis Batas)</span>
                <span className="font-mono text-indigo-400">{page.gutterSize || 12}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={28}
                step={2}
                value={page.gutterSize || 12}
                onChange={(e) => handleChangeGutter(Number(e.target.value))}
                className="w-full mt-2"
              />
            </div>

            {/* Canvas Background Color */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                Warna Dasar Kanvas
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Dark Webtoon', val: '#0f172a' },
                  { label: 'Pitch Black', val: '#000000' },
                  { label: 'Clean White', val: '#ffffff' },
                ].map((bg) => (
                  <button
                    key={bg.val}
                    type="button"
                    onClick={() => handleChangeBg(bg.val)}
                    className={`p-2 rounded-lg border text-center text-xs font-semibold transition ${
                      page.backgroundColor === bg.val
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full mx-auto mb-1 border border-slate-600"
                      style={{ backgroundColor: bg.val }}
                    />
                    <span>{bg.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
