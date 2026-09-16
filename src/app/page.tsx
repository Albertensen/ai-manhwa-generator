'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Layout,
  FileText,
  Film,
  Download,
  Sliders,
  Sparkles,
  Volume2,
  Mic,
  Copy,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  X,
  RefreshCw,
  Image as ImageIcon,
  UserCheck,
  Music
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ManhwaProject, ManhwaScene, ManhwaCharacter } from '@/lib/types';
import {
  MangaPageData,
  MangaPanelData,
  SpeechBubbleData,
  ComicLayoutType
} from '@/lib/manga-types';
import { generateLayoutPanels } from '@/components/manga/ComicEditorCanvas';

// Dynamic imports for browser-only canvas and video players
const ComicEditorCanvas = dynamic(
  () => import('@/components/manga/ComicEditorCanvas'),
  { ssr: false }
);

const RemotionPreviewPlayer = dynamic(
  () => import('@/components/RemotionPreviewPlayer'),
  { ssr: false }
);

type MangaStudioTab = 'script_engine' | 'canvas_editor' | 'export_recap';

export default function MangaFlowStudio() {
  // ---------------------------------------------------------------------------
  // Top Level Navigation
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<MangaStudioTab>('canvas_editor');
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Project & Story Script State (Tab 1)
  // ---------------------------------------------------------------------------
  const [projects, setProjects] = useState<ManhwaProject[]>([]);
  const [activeProject, setActiveProject] = useState<ManhwaProject | null>(null);
  const [storyTitle, setStoryTitle] = useState<string>('Shadow Sovereign: Bangkitnya Pemburu Bayangan');
  const [genre, setGenre] = useState<string>('Action Fantasy (Solo Leveling Style)');
  const [artStyle, setArtStyle] = useState<string>('Solo Leveling / Dark Fantasy');
  const [storySynopsis, setStorySynopsis] = useState<string>(
    'Kaelen, pemburu peringkat E terlemah, terperangkap di ruang terdalam dungeon ganda kuil Cartenon. Saat rekan-rekannya meninggalkannya menghadapi patung dewa raksasa, dia menerima quest rahasia misterius: [Pemberian Takhta Shadow Monarch]. Darah hitam mengalir dari bilahnya saat dia bangkit menolak kematian.'
  );
  const [isGeneratingScript, setIsGeneratingScript] = useState<boolean>(false);

  // Multi-Character Master Sheet
  const [characters, setCharacters] = useState<Array<{
    id: string;
    name: string;
    role: 'protagonist' | 'heroine' | 'antagonist' | 'supporting';
    appearance_locked_prompt: string;
    reference_image_url?: string | null;
  }>>([
    {
      id: 'char_protagonist',
      name: 'Kaelen Vance',
      role: 'protagonist',
      appearance_locked_prompt: '1man, solo, messy black parted hair, piercing glowing electric blue eyes, sharp jawline, black trench coat with high collar, dark purple shadow aura swirling around hands, athletic muscular build, solo leveling webtoon art style, dramatic rim lighting, 8k masterpiece',
      reference_image_url: null,
    },
    {
      id: 'char_heroine',
      name: 'Seraphina Frost',
      role: 'heroine',
      appearance_locked_prompt: '1girl, solo, long silver ponytail, piercing emerald green eyes, elegant white and gold holy knight armor, glowing holy sword, slender athletic build, beautiful webtoon heroine face, solo leveling art style, 8k',
      reference_image_url: null,
    },
    {
      id: 'char_antagonist',
      name: 'Demon King Malakor',
      role: 'antagonist',
      appearance_locked_prompt: '1demon lord, massive obsidian heavy plate armor, glowing blood-red eyes, curved demonic horns, crackling crimson dark lightning aura, towering menacing presence, high fantasy webtoon art, 8k',
      reference_image_url: null,
    },
  ]);
  const [activeCharIndex, setActiveCharIndex] = useState<number>(0);
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);

  const handleAddCharacter = () => {
    const newIdx = characters.length + 1;
    const newChar = {
      id: `char_${Date.now()}`,
      name: `Karakter Baru ${newIdx}`,
      role: 'supporting' as const,
      appearance_locked_prompt: '1person, detailed webtoon art style, highly detailed illustration, 8k',
      reference_image_url: null,
    };
    setCharacters([...characters, newChar]);
    setActiveCharIndex(characters.length);
  };

  const handleUpdateCharacter = (field: string, value: string) => {
    setCharacters(prev => {
      const copy = [...prev];
      if (copy[activeCharIndex]) {
        copy[activeCharIndex] = { ...copy[activeCharIndex], [field]: value };
      }
      return copy;
    });
  };

  const handleDeleteCharacter = (idx: number) => {
    if (characters.length <= 1) return;
    setCharacters(prev => prev.filter((_, i) => i !== idx));
    setActiveCharIndex(0);
  };

  const handleBreakdownStory = async () => {
    setIsGeneratingStory(true);
    try {
      const protagonist = characters.find(c => c.role === 'protagonist') || characters[0];
      const antagonist = characters.find(c => c.role === 'antagonist') || characters[1] || characters[0];
      
      const newPages: MangaPageData[] = [
        {
          id: `page_${Date.now()}_1`,
          pageNumber: 1,
          title: `Halaman 1: Permulaan (${storyTitle})`,
          layout: 'webtoon',
          canvasWidth: 720,
          canvasHeight: 1080,
          gutterSize: 12,
          backgroundColor: '#0f172a',
          panels: [
            {
              id: 'p1_1',
              panelNumber: 1,
              label: 'Panel 1: Establishing Shot',
              x: 24,
              y: 24,
              width: 672,
              height: 310,
              visualPrompt: `Wide cinematic view of ${genre} world, ${storySynopsis.slice(0, 100)}`,
              dialogue: `Di sinilah kisah ${storyTitle} dimulai...`,
              speaker: protagonist?.name || 'Narrator'
            },
            {
              id: 'p1_2',
              panelNumber: 2,
              label: 'Panel 2: Tension & Focus',
              x: 24,
              y: 346,
              width: 672,
              height: 310,
              visualPrompt: `Close up of ${protagonist?.name}, ${protagonist?.appearance_locked_prompt}`,
              dialogue: 'Aku tidak akan menyerah, apapun yang terjadi!',
              speaker: protagonist?.name || 'Hero'
            },
            {
              id: 'p1_3',
              panelNumber: 3,
              label: 'Panel 3: Climax / Action',
              x: 24,
              y: 668,
              width: 672,
              height: 310,
              visualPrompt: `Dynamic battle clash, ${protagonist?.name} vs ${antagonist?.name}, high intensity`,
              dialogue: 'Terimalah kekuatanku!!',
              speaker: protagonist?.name || 'Hero',
              sfxPrompt: 'SLASH!!'
            }
          ],
          bubbles: [
            {
              id: 'b1',
              type: 'oval',
              x: 60,
              y: 60,
              width: 220,
              height: 80,
              tailX: 40,
              tailY: 100,
              text: `Di sinilah kisah ${storyTitle} dimulai...`,
              speaker: protagonist?.name || 'Narrator',
              fontSize: 12,
              textColor: '#0f172a',
              bgColor: '#ffffff',
              borderColor: '#000000',
            },
            {
              id: 'b2',
              type: 'thought',
              x: 440,
              y: 400,
              width: 220,
              height: 85,
              tailX: 180,
              tailY: 110,
              text: 'Aku tidak akan menyerah, apapun yang terjadi!',
              speaker: protagonist?.name || 'Hero',
              fontSize: 12,
              textColor: '#0f172a',
              bgColor: '#ffffff',
              borderColor: '#000000',
            },
            {
              id: 'b3',
              type: 'shout',
              x: 240,
              y: 760,
              width: 240,
              height: 90,
              tailX: 120,
              tailY: 115,
              text: 'Terimalah kekuatanku!!',
              speaker: protagonist?.name || 'Hero',
              fontSize: 13,
              textColor: '#0f172a',
              bgColor: '#ffffff',
              borderColor: '#e11d48',
            }
          ],
          sfxStickers: [
            {
              id: 'sfx_1',
              text: 'SLASH!!',
              x: 280,
              y: 720,
              rotation: -8,
              fontSize: 42,
              color: '#f59e0b',
              strokeColor: '#000000',
              stylePreset: 'impact',
            }
          ]
        },
        {
          id: `page_${Date.now()}_2`,
          pageNumber: 2,
          title: `Halaman 2: Benturan Kekuatan`,
          layout: 'action',
          canvasWidth: 720,
          canvasHeight: 1080,
          gutterSize: 12,
          backgroundColor: '#0f172a',
          panels: generateLayoutPanels('action', 720, 1080, 12),
          bubbles: [
            {
              id: 'b4',
              type: 'shout',
              x: 100,
              y: 80,
              width: 230,
              height: 85,
              tailX: 40,
              tailY: 100,
              text: `Jangan halangi jalanku, ${antagonist?.name}!`,
              speaker: protagonist?.name || 'Hero',
              fontSize: 12,
              textColor: '#0f172a',
              bgColor: '#ffffff',
              borderColor: '#e11d48',
            },
            {
              id: 'b5',
              type: 'shout',
              x: 420,
              y: 400,
              width: 220,
              height: 90,
              tailX: 110,
              tailY: 115,
              text: 'Mati kau di tanganku!',
              speaker: antagonist?.name || 'Villain',
              fontSize: 13,
              textColor: '#0f172a',
              bgColor: '#ffffff',
              borderColor: '#000000',
            }
          ],
          sfxStickers: [
            {
              id: 'sfx_2',
              text: 'DUMMM!',
              x: 240,
              y: 780,
              rotation: 12,
              fontSize: 46,
              color: '#e11d48',
              strokeColor: '#000000',
              stylePreset: 'slash',
            }
          ]
        }
      ];

      setPages(newPages);
      setCurrentPageIndex(0);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Interactive Comic Canvas State (Tab 2)
  // ---------------------------------------------------------------------------
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [pages, setPages] = useState<MangaPageData[]>([
    {
      id: 'page_1',
      pageNumber: 1,
      title: 'Halaman 1: Kebangkitan Bayangan',
      layout: 'webtoon',
      canvasWidth: 720,
      canvasHeight: 1080,
      gutterSize: 12,
      backgroundColor: '#0f172a',
      panels: generateLayoutPanels('webtoon', 720, 1080, 12),
      bubbles: [
        {
          id: 'b1',
          type: 'oval',
          x: 48,
          y: 60,
          width: 200,
          height: 80,
          tailX: 40,
          tailY: 100,
          text: 'Di reruntuhan labirin kuno ini... aku tidak akan mati sia-sia.',
          speaker: 'Kaelen',
          fontSize: 12,
          textColor: '#0f172a',
          bgColor: '#ffffff',
          borderColor: '#000000',
        },
        {
          id: 'b2',
          type: 'thought',
          x: 460,
          y: 420,
          width: 210,
          height: 85,
          tailX: 180,
          tailY: 110,
          text: 'Aura hitam ini... apakah ini kekuatan raja terdahulu?',
          speaker: 'Kaelen',
          fontSize: 12,
          textColor: '#0f172a',
          bgColor: '#ffffff',
          borderColor: '#000000',
        },
        {
          id: 'b3',
          type: 'shout',
          x: 240,
          y: 780,
          width: 230,
          height: 90,
          tailX: 115,
          tailY: 115,
          text: 'BANGKITLAH, TENTARA BAYANGAN!!',
          speaker: 'Kaelen',
          fontSize: 13,
          textColor: '#0f172a',
          bgColor: '#ffffff',
          borderColor: '#e11d48',
        },
      ],
      sfxStickers: [
        {
          id: 'sfx_1',
          text: 'DUMMM!',
          x: 280,
          y: 720,
          rotation: -8,
          fontSize: 42,
          color: '#f59e0b',
          strokeColor: '#000000',
          stylePreset: 'impact',
        },
      ],
    },
    {
      id: 'page_2',
      pageNumber: 2,
      title: 'Halaman 2: Benturan Pertama',
      layout: 'action',
      canvasWidth: 720,
      canvasHeight: 1080,
      gutterSize: 12,
      backgroundColor: '#0f172a',
      panels: generateLayoutPanels('action', 720, 1080, 12),
      bubbles: [
        {
          id: 'b4',
          type: 'oval',
          x: 60,
          y: 60,
          width: 210,
          height: 80,
          tailX: 40,
          tailY: 100,
          text: 'Seraphina, mundur ke belakangku sekarang!',
          speaker: 'Kaelen',
          fontSize: 12,
          textColor: '#0f172a',
          bgColor: '#ffffff',
          borderColor: '#000000',
        },
        {
          id: 'b5',
          type: 'shout',
          x: 420,
          y: 400,
          width: 220,
          height: 90,
          tailX: 110,
          tailY: 115,
          text: 'MATI KAU SERANGGA!',
          speaker: 'Demon Lord',
          fontSize: 13,
          textColor: '#0f172a',
          bgColor: '#ffffff',
          borderColor: '#e11d48',
        },
      ],
      sfxStickers: [
        {
          id: 'sfx_2',
          text: 'SLASH!!',
          x: 180,
          y: 420,
          rotation: 12,
          fontSize: 38,
          color: '#e11d48',
          strokeColor: '#000000',
          stylePreset: 'slash',
        },
      ],
    },
  ]);

  const activePage = pages[currentPageIndex] || pages[0];

  const handleUpdateActivePage = (updated: MangaPageData) => {
    const next = [...pages];
    next[currentPageIndex] = updated;
    setPages(next);
  };

  const handleAddNewPage = () => {
    const nextNum = pages.length + 1;
    const newPage: MangaPageData = {
      id: `page_${Date.now()}`,
      pageNumber: nextNum,
      title: `Halaman ${nextNum}`,
      layout: 'webtoon',
      canvasWidth: 720,
      canvasHeight: 1080,
      gutterSize: 12,
      backgroundColor: '#0f172a',
      panels: generateLayoutPanels('webtoon', 720, 1080, 12),
      bubbles: [],
      sfxStickers: [],
    };
    setPages([...pages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  // ---------------------------------------------------------------------------
  // Export & Motion Recap State (Tab 3)
  // ---------------------------------------------------------------------------
  const [renderEngine, setRenderEngine] = useState<'remotion' | 'ffmpeg'>('remotion');
  const [voiceEngine, setVoiceEngine] = useState<'edge_tts' | 'voxcpm'>('edge_tts');
  const [voiceEmotion, setVoiceEmotion] = useState<'dramatic' | 'intense' | 'calm' | 'whisper' | 'angry'>('dramatic');
  const [bgmPreset, setBgmPreset] = useState<'epic_battle' | 'mystery_dungeon' | 'melancholy_sad'>('epic_battle');
  const [isRemotionRendering, setIsRemotionRendering] = useState<boolean>(false);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [remotionCliCommand, setRemotionCliCommand] = useState<string | null>(null);

  // Copy helper
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  // Convert current comic page panels to Remotion recap scenes
  const remotionScenes = activePage.panels.map((p, idx) => ({
    id: p.id,
    scene_order: idx + 1,
    imageUrl: p.imageUrl || null,
    narration_text: p.dialogue || p.visualPrompt,
    dialogue_text: p.dialogue,
    camera_motion: idx % 2 === 0 ? 'zoom_in' : 'pan_right',
    duration_seconds: 4.5,
    audioUrl: p.audioUrl || null,
  }));

  // Trigger Remotion Render
  const handleTriggerRemotionRender = async () => {
    try {
      setIsRemotionRendering(true);
      setErrorMsg(null);

      const res = await fetch('/api/render/remotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject?.id || 'demo_project',
          bgmPreset,
          voiceEngine,
          voiceEmotion,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Remotion render');

      setRemotionCliCommand(data.cliCommand || null);

      if (data.status === 'completed' && data.videoUrl) {
        setRenderedVideoUrl(data.videoUrl);
        setIsRemotionRendering(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Render error');
      setIsRemotionRendering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* ========================================================================= */}
      {/* TOP HEADER & MANGAFLOW TAB NAVIGATION */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layout className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  MangaFlow<span className="text-indigo-400">.Studio</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-mono font-bold tracking-wide">
                  PAGE STUDIO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Professional Webtoon &amp; Manga Page Creator + 2.5D Motion Recap
              </p>
            </div>
          </div>

          {/* 3 Main Studio Work Tabs */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('script_engine')}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'script_engine'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Script &amp; Cast</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('canvas_editor')}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'canvas_editor'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>2. Comic Canvas</span>
              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                CORE
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('export_recap')}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'export_recap'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>3. Export &amp; Motion</span>
            </button>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsSystemSettingsOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold transition"
              title="System Settings (Backend Worker, Voice Engine, CLI)"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">System Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN STUDIO VIEWPORT */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6">
        {/* ===================================================================== */}
        {/* TAB 1: [Script & Character Engine] */}
        {/* ===================================================================== */}
        {activeTab === 'script_engine' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold tracking-wider">
                  TAB 1 • SCRIPT &amp; CHARACTER ENGINE
                </span>
                <h1 className="text-xl font-extrabold text-white mt-2">
                  Story Script Breakdown &amp; Character Master Sheet
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Masukkan naskah atau premis cerita komik Anda. Sistem memecah cerita menjadi urutan panel per halaman lengkap dengan deskripsi visual prompt untuk Google Flow dan dialog karakter.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('canvas_editor')}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition self-start md:self-auto shrink-0"
              >
                <span>Buka Comic Canvas Editor</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 2-Column Grid: Left (Premise & Characters), Right (Script Pages) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 Cols): Script Input & Multi-Character Sheet */}
              <div className="lg:col-span-5 space-y-5">
                {/* Story Synopsis Box */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Premis &amp; Naskah Cerita</span>
                  </h3>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Judul Proyek</label>
                    <input
                      type="text"
                      value={storyTitle}
                      onChange={(e) => setStoryTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Genre</label>
                      <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-400">Gaya Art</label>
                      <select
                        value={artStyle}
                        onChange={(e) => setArtStyle(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                      >
                        <option value="Solo Leveling / Dark Fantasy">Solo Leveling / Dark Fantasy</option>
                        <option value="Omniscient Reader / Modern Hunter">Omniscient Reader / Modern</option>
                        <option value="Murim / Heavenly Demon Cultivation">Murim Martial Arts</option>
                        <option value="Magic Emperor / Demonic Sovereign">Magic Emperor</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400">Sinopsis / Naskah</label>
                    <textarea
                      rows={5}
                      value={storySynopsis}
                      onChange={(e) => setStorySynopsis(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingStory}
                    onClick={handleBreakdownStory}
                    className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingStory ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Memecah Naskah ke Komik...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>✨ Pecah Naskah ke Halaman &amp; Panel Komik</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Multi-Character Master Sheet */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                      <UserCheck className="w-4 h-4 text-purple-400" />
                      <span>Multi-Character Master Sheet</span>
                    </h3>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                      Consistency Lock
                    </span>
                  </div>

                  {/* Character Selector Pills + Add Button */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                    {characters.map((char, idx) => (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setActiveCharIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                          activeCharIndex === idx
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        {char.name} ({char.role})
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleAddCharacter}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-purple-300 transition flex items-center space-x-1 shrink-0 border border-slate-700"
                      title="Tambah Karakter Baru"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-400" />
                      <span>+ Karakter</span>
                    </button>
                  </div>

                  {/* Active Character Detail - Editable Fields */}
                  {characters[activeCharIndex] && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={characters[activeCharIndex].name}
                          onChange={(e) => handleUpdateCharacter('name', e.target.value)}
                          placeholder="Nama Karakter"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                        />
                        <select
                          value={characters[activeCharIndex].role}
                          onChange={(e) => handleUpdateCharacter('role', e.target.value)}
                          className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono uppercase text-purple-300 focus:outline-none"
                        >
                          <option value="protagonist">Protagonist</option>
                          <option value="heroine">Heroine</option>
                          <option value="antagonist">Antagonist</option>
                          <option value="supporting">Supporting</option>
                          <option value="mentor">Mentor</option>
                        </select>
                        {characters.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCharacter(activeCharIndex)}
                            className="p-1.5 rounded-lg hover:bg-rose-950/60 text-rose-400 transition"
                            title="Hapus Karakter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span>Prompt Konsistensi AutoFlow / Google Flow:</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                characters[activeCharIndex].appearance_locked_prompt,
                                `char_${characters[activeCharIndex].id}`
                              )
                            }
                            className="inline-flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 text-[10px] font-semibold"
                          >
                            {copiedType === `char_${characters[activeCharIndex].id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy Prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={characters[activeCharIndex].appearance_locked_prompt}
                          onChange={(e) => handleUpdateCharacter('appearance_locked_prompt', e.target.value)}
                          placeholder="Masukkan ciri fisik karakter..."
                          className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono leading-relaxed focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (7 Cols): Script Breakdown into Pages & Panels */}
              <div className="lg:col-span-7 space-y-5">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Hasil Pembagian Naskah ke Halaman Komik
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tiap halaman dibagi menjadi panel-panel dengan deskripsi gambar, dialog, dan balon ucapan otomatis.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-400">
                      {pages.length} Halaman Siap
                    </span>
                  </div>

                  {/* Pages Loop */}
                  <div className="space-y-4">
                    {pages.map((pg, pgIdx) => (
                      <div
                        key={pg.id}
                        className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold">
                              Halaman {pg.pageNumber}
                            </span>
                            <span className="text-xs font-bold text-white">{pg.title}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setCurrentPageIndex(pgIdx);
                              setActiveTab('canvas_editor');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-[11px] font-semibold text-indigo-200 hover:text-white border border-indigo-500/30 transition"
                          >
                            <span>Buka di Canvas Editor</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Panels in this page */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {pg.panels.map((pnl) => (
                            <div
                              key={pnl.id}
                              className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-200 font-mono text-[11px]">
                                  {pnl.label}
                                </span>
                                {pnl.sfxPrompt && (
                                  <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono text-[9px] font-bold">
                                    SFX: {pnl.sfxPrompt}
                                  </span>
                                )}
                              </div>

                              <div className="text-[11px] text-slate-400 line-clamp-2">
                                <span className="text-slate-500">Visual:</span> {pnl.visualPrompt}
                              </div>

                              <div className="p-2 rounded bg-slate-950 border border-slate-800/60 text-[11px] text-amber-300">
                                <span className="font-bold text-indigo-400">{pnl.speaker}:</span> &quot;{pnl.dialogue}&quot;
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  copyToClipboard(
                                    `${pnl.visualPrompt}, ${artStyle}, manhwa high quality art style, 8k masterpiece`,
                                    `pnl_prompt_${pnl.id}`
                                  )
                                }
                                className="w-full inline-flex items-center justify-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 transition"
                              >
                                {copiedType === `pnl_prompt_${pnl.id}` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Prompt Google Flow Tersalin!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Prompt Google Flow</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: [Interactive Comic Canvas Editor] (FITUR UTAMA) */}
        {/* ===================================================================== */}
        {activeTab === 'canvas_editor' && (
          <div className="space-y-4 animate-fadeIn">
            {/* Sub-Header Page Switcher Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Daftar Halaman:
                </span>
                <div className="flex items-center space-x-1.5">
                  {pages.map((pg, idx) => (
                    <button
                      key={pg.id}
                      type="button"
                      onClick={() => setCurrentPageIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        currentPageIndex === idx
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      Halaman {pg.pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddNewPage}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition flex items-center space-x-1"
                    title="Tambah Halaman Komik Baru"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>+ Halaman</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-400">
                <span>Layout: <strong className="text-white capitalize">{activePage.layout}</strong></span>
                <span>•</span>
                <span>Balon: <strong className="text-white">{activePage.bubbles.length}</strong></span>
                <span>•</span>
                <span>SFX: <strong className="text-white">{activePage.sfxStickers.length}</strong></span>
              </div>
            </div>

            {/* The Main Konva Comic Canvas Editor Component */}
            <ComicEditorCanvas
              page={activePage}
              onUpdatePage={handleUpdateActivePage}
              onGoToMotionRecap={() => setActiveTab('export_recap')}
            />
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: [Export & Motion Recap] */}
        {/* ===================================================================== */}
        {activeTab === 'export_recap' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold tracking-wider">
                  TAB 3 • EXPORT &amp; MOTION RECAP
                </span>
                <h1 className="text-xl font-extrabold text-white mt-2">
                  Export Komik Digital &amp; Animasi Video Recap Remotion 2.5D
                </h1>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Ekspor halaman komik ke file resolusi tinggi siap baca atau ubah urutan panel komik Anda secara instan menjadi video animasi gerak vertikal 9:16 lengkap dengan vokal AI dan BGM dinamis.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('canvas_editor')}
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition self-start md:self-auto shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Canvas</span>
              </button>
            </div>

            {/* Dual Action Grid: Export High-Res PNG vs Animate Video Recap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Box 1: Digital Comic Export (Print & Webtoon HQ) */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Export Comic Page (High-Res PNG / PDF Ready)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Unduh halaman komik aktif dalam format grafis kristal resolusi tinggi (pixel ratio 2x) dengan seluruh balon ucapan dan efek teks aksi yang sudah di-render tajam.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Halaman Terpilih:</span>
                      <span className="text-white">Halaman {activePage.pageNumber} ({activePage.title})</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Format Target:</span>
                      <span className="text-emerald-400">PNG Lossless (1440 x 2160 px @ 2x)</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Kompatibilitas:</span>
                      <span className="text-slate-300">Webtoon, Tapas, Manga Plus, Print</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('canvas_editor');
                  }}
                  className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Buka Canvas &amp; Unduh PNG</span>
                </button>
              </div>

              {/* Box 2: Animate Page to Video Recap (Remotion 2.5D) */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-5">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                    <Film className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">
                      Animate Page to Video Recap (Remotion)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                      2.5D PARALLAX
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Sistem otomatis mengubah urutan Panel 1 -&gt; Panel 2 -&gt; Panel 3 menjadi video gerak vertikal 9:16 lengkap dengan subtitle karaoke emas, vokal AI, dan BGM.
                  </p>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Video Engine:</span>
                      <span className="text-indigo-300">Remotion 2.5D (Kinetic Captions + RMBG)</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Voice Engine:</span>
                      <span className="text-purple-300 capitalize">{voiceEngine} ({voiceEmotion})</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>BGM Soundtrack:</span>
                      <span className="text-amber-300 capitalize">{bgmPreset.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={isRemotionRendering}
                    onClick={handleTriggerRemotionRender}
                    className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
                  >
                    {isRemotionRendering ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Merender Video 2.5D Remotion...</span>
                      </>
                    ) : (
                      <>
                        <Film className="w-4 h-4" />
                        <span>Mulai Render Video Recap 2.5D</span>
                      </>
                    )}
                  </button>

                  {remotionCliCommand && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                      <span className="truncate">CLI: {remotionCliCommand}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(remotionCliCommand, 'rem_cli')}
                        className="ml-2 text-indigo-400 hover:text-indigo-300"
                      >
                        {copiedType === 'rem_cli' ? 'Tersalin' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Live Web Studio Remotion Player (Live Zero-Export Playback) */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Play className="w-4 h-4 text-indigo-400" />
                    <span>Live Studio Player Preview (Zero-Export Instant Playback)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Putar video recap langsung di browser tanpa perlu menunggu proses render video selesai.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                  @remotion/player Active
                </span>
              </div>

              {/* Remotion Player Container */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex justify-center">
                <RemotionPreviewPlayer
                  scenes={remotionScenes as any}
                  projectTitle={storyTitle}
                  bgmPreset={bgmPreset}
                  bgmVolume={0.15}
                />
              </div>

              {renderedVideoUrl && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-200">
                      Video MP4 Berhasil Dirender!
                    </span>
                  </div>
                  <a
                    href={renderedVideoUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Video MP4</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* HIDDEN SYSTEM SETTINGS DRAWER */}
      {/* ========================================================================= */}
      {isSystemSettingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setIsSystemSettingsOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 w-full max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl animate-slideLeft">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-base font-bold text-white">System &amp; Engine Settings</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSystemSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. Video Render Engine */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Video Render Engine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRenderEngine('remotion')}
                    className={`p-3 rounded-xl border text-left transition ${
                      renderEngine === 'remotion'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs">Remotion 2.5D</div>
                    <div className="text-[10px] text-indigo-300 font-normal mt-0.5">Parallax + Kinetic Sub</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenderEngine('ffmpeg')}
                    className={`p-3 rounded-xl border text-left transition ${
                      renderEngine === 'ffmpeg'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs">FFmpeg Concat</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">Fast Stream Stitch</div>
                  </button>
                </div>
              </div>

              {/* 2. Voice Engine Selector */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Voice Synthesis Engine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceEngine('edge_tts')}
                    className={`p-3 rounded-xl border text-left transition ${
                      voiceEngine === 'edge_tts'
                        ? 'bg-indigo-950/40 border-indigo-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs">Edge-TTS</div>
                    <div className="text-[10px] text-slate-400 font-normal mt-0.5">ArdiNeural • Fast</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceEngine('voxcpm')}
                    className={`p-3 rounded-xl border text-left transition ${
                      voiceEngine === 'voxcpm'
                        ? 'bg-purple-950/40 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs">VoxCPM Neural</div>
                    <div className="text-[10px] text-purple-300 font-normal mt-0.5">48kHz • RTX 3060 Ti</div>
                  </button>
                </div>

                {voiceEngine === 'voxcpm' && (
                  <div className="pt-2">
                    <span className="text-[11px] text-slate-400">Emosi Suara VoxCPM:</span>
                    <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                      {(['dramatic', 'intense', 'calm', 'whisper', 'angry'] as const).map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => setVoiceEmotion(emo)}
                          className={`py-1 rounded text-[10px] font-bold capitalize transition ${
                            voiceEmotion === emo
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. BGM Preset Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  BGM Soundtrack Preset
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'epic_battle', label: 'Epic Battle / Boss Fight' },
                    { id: 'mystery_dungeon', label: 'Dark Mystery Dungeon' },
                    { id: 'melancholy_sad', label: 'Emotional / Tragic Awakening' },
                  ].map((bgm) => (
                    <div
                      key={bgm.id}
                      onClick={() => setBgmPreset(bgm.id as any)}
                      className={`p-2.5 rounded-xl border cursor-pointer text-xs flex items-center justify-between transition ${
                        bgmPreset === bgm.id
                          ? 'border-amber-500 bg-amber-950/30 text-white font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{bgm.label}</span>
                      {bgmPreset === bgm.id && (
                        <span className="text-[10px] text-amber-400 font-mono">AKTIF</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. Background Worker Status */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2 font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Worker Queue:</span>
                  <span className="text-emerald-400">Connected (Supabase)</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>ComfyUI Server:</span>
                  <span className="text-slate-300">127.0.0.1:8188</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Chrome Headless:</span>
                  <span className="text-emerald-400">Installed (@remotion/cli)</span>
                </div>
              </div>
            </div>

            {/* Close Drawer Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSystemSettingsOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
              >
                Tutup Pengaturan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
