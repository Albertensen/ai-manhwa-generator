'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Lock, 
  Unlock,
  Play, 
  Film, 
  Volume2, 
  Image as ImageIcon, 
  RefreshCw, 
  Layers, 
  Clapperboard, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Trash2,
  Music,
  RotateCcw,
  Copy,
  Check,
  Download,
  FileText,
  Upload,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Sliders,
  ShieldCheck,
  Video
} from 'lucide-react';
import { ManhwaProject, ManhwaScene } from '@/lib/types';

export default function StudioPage() {
  // Wizard Navigation: Step 1 to Step 5
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [showStorySetup, setShowStorySetup] = useState<boolean>(true);

  // Global Story Setup State
  const [projectTitle, setProjectTitle] = useState('Kebangkitan Sang Penguasa Bayangan');
  const [characterName, setCharacterName] = useState('Kang Min-Woo');
  const [characterLockPrompt, setCharacterLockPrompt] = useState(
    '1man, solo, messy black parted hair, glowing electric blue eyes, sharp jawline, athletic silhouette, black hooded long coat with glowing purple mana aura, high contrast manhwa art style, sharp lineart, 8k masterpiece'
  );
  const [stylePreset, setStylePreset] = useState('Solo Leveling / Dark Fantasy');
  const [bgmPreset, setBgmPreset] = useState<'epic_battle' | 'mystery_dungeon' | 'melancholy_sad'>('epic_battle');
  const [storyIdea, setStoryIdea] = useState(
    'Setelah 10 tahun terjebak di dungeon peringkat terendah, sebuah jendela sistem misterius muncul di hadapannya. Peringkatnya melonjak dari E-rank menjadi Penguasa Bayangan, dan monster bos pertama tunduk di bawah kakinya.'
  );
  const [sceneCount, setSceneCount] = useState<number>(5);

  // Character Master State (Step 1)
  const [isCharacterLocked, setIsCharacterLocked] = useState<boolean>(true);
  const [uploadedCharacterUrl, setUploadedCharacterUrl] = useState<string | null>(null);
  const [isUploadingChar, setIsUploadingChar] = useState<boolean>(false);
  const charFileInputRef = useRef<HTMLInputElement>(null);

  // Assembly & Video Drop State (Step 5)
  const [uploadedClips, setUploadedClips] = useState<Record<number, string>>({});
  const [isUploadingClips, setIsUploadingClips] = useState<boolean>(false);
  const [isAssembling, setIsAssembling] = useState<boolean>(false);
  const videoClipsInputRef = useRef<HTMLInputElement>(null);

  // Projects & App State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [projects, setProjects] = useState<ManhwaProject[]>([]);
  const [activeProject, setActiveProject] = useState<ManhwaProject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showRawDrawer, setShowRawDrawer] = useState<boolean>(false);

  // Presets mapping
  const stylePresets: Record<string, { prompt: string; desc: string; defaultBgm: 'epic_battle' | 'mystery_dungeon' | 'melancholy_sad' }> = {
    'Solo Leveling / Dark Fantasy': {
      prompt: '1man, solo, messy black parted hair, glowing electric blue eyes, sharp jawline, black long coat, dark purple shadow aura, solo leveling art style, dramatic rim lighting, 8k',
      desc: 'Dark shadows, glowing blue/purple aura, intense sharp eyes',
      defaultBgm: 'epic_battle'
    },
    'Omniscient Reader / Modern Hunter': {
      prompt: '1man, solo, neat dark hair, determined obsidian eyes, white trench coat over formal dark suit, modern seoul apocalypse background, webtoon clean lineart, vibrant colors',
      desc: 'White trenchcoat, modern apocalypse hunter, clean manhwa colors',
      defaultBgm: 'epic_battle'
    },
    'Murim / Heavenly Demon Cultivation': {
      prompt: '1man, solo, long flowing jet-black hair tied in topknot, crimson glowing eyes, ornate martial arts robes with silver dragon embroidery, floating martial aura, ancient pagoda ruins',
      desc: 'Traditional martial robes, flowing hair, ancient murim aesthetic',
      defaultBgm: 'mystery_dungeon'
    },
    'Magic Emperor / Demonic Sovereign': {
      prompt: '1man, solo, silver styled hair, piercing amethyst purple eyes, dark imperial robes with golden cloud patterns, crackling dark purple lightning, arrogant smirk, high tension manhwa art',
      desc: 'Silver hair, imperial cultivation robes, demonic lightning aura',
      defaultBgm: 'epic_battle'
    },
    'Villainess / Imperial Noblesse': {
      prompt: '1girl, solo, long wavy platinum blonde hair, piercing amethyst violet eyes, opulent emerald embroidered royal gown, gold jewelry, grand baroque palace ballroom, soft dramatic glow',
      desc: 'Royal elegance, opulent palace background, lavish webtoon romance',
      defaultBgm: 'melancholy_sad'
    }
  };

  const bgmOptions = [
    { 
      id: 'epic_battle', 
      label: 'Epic Battle (Solo Leveling)', 
      desc: 'Orchestral choir, heavy brass, aggressive percussion synth', 
      icon: '⚔️',
      aiMusicPrompt: 'Epic orchestral battle theme, heavy synth bass, intense choir chants, aggressive war drums, cinematic anime crescendo, 140 bpm'
    },
    { 
      id: 'mystery_dungeon', 
      label: 'Mystery Dungeon (Suspense)', 
      desc: 'Dark ambient drones, dissonant strings, low sub-bass echoes', 
      icon: '🔮',
      aiMusicPrompt: 'Dark ambient dungeon exploration soundtrack, eerie cello drone, low sub bass, reverberant cave echoes, tense atmosphere, 90 bpm'
    },
    { 
      id: 'melancholy_sad', 
      label: 'Melancholy & Tragic', 
      desc: 'Solo emotional piano, weeping cello, soft rain ambience', 
      icon: '🥀',
      aiMusicPrompt: 'Emotional sorrowful anime soundtrack, solo piano melody, gentle cello harmony, soft distant rain, heartfelt sadness, 75 bpm'
    }
  ];

  // Helper functions for Step 1: Character Variations
  const getCharacterVariations = () => {
    return [
      {
        id: 'var_1',
        title: 'Variasi 1: Masterpiece Key Visual (Front 3/4)',
        badge: 'Rekomendasi Utama',
        desc: 'Pose standar key visual webtoon dengan tatapan tajam dan pencahayaan kontras tinggi. Ideal sebagai referensi paten di AutoFlow.',
        prompt: `masterpiece, solo portrait, front 3/4 angle, Korean manhwa webtoon key visual, ${characterName}, ${characterLockPrompt}, clean lineart, expressive sharp eyes, high contrast rim lighting, dark studio atmospheric background, 8k resolution, highly consistent master character sheet`,
      },
      {
        id: 'var_2',
        title: 'Variasi 2: Awakened State & Surging Mana Aura',
        badge: 'Mode Tempur / Awakening',
        desc: 'Karakter dikelilingi aura energi magis berkilau dengan efek partikel melayang untuk adegan aksi intensitas tinggi.',
        prompt: `masterpiece, solo, combat battle stance, ${characterName}, ${characterLockPrompt}, surging glowing mana aura enveloping body, floating hair strands, crackling electricity embers, dark volumetric fog, dynamic manhwa angle, unreal engine 5 render, 8k`,
      },
      {
        id: 'var_3',
        title: 'Variasi 3: Extreme Close-Up & Piercing Gaze',
        badge: 'Close-Up Dramatis',
        desc: 'Fokus ketat pada ekspresi wajah, detail mata bersinar tajam, dan bayangan dramatis untuk momen puncak emosional.',
        prompt: `masterpiece, extreme close-up on face, ${characterName}, ${characterLockPrompt}, razor sharp jawline, glowing piercing eyes with intricate iris details, dynamic wind blowing hair across forehead, dramatic shadow cast, high tension webtoon panel, ultra-detailed 8k`,
      },
      {
        id: 'var_4',
        title: 'Variasi 4: Silhouette & Shadow Wings / Sovereign',
        badge: 'Pose Megah / Silhouette',
        desc: 'Pose penuh dengan sayap bayangan atau jubah berkibar di atas reruntuhan batu, memberikan siluet megah sang penguasa.',
        prompt: `masterpiece, dynamic full-body shot, ${characterName}, ${characterLockPrompt}, standing on shattered dungeon stone, gigantic shadow wings unfurling behind back, dark vortex sky, particles drifting upward, epic manhwa cover art, 8k wallpaper`,
      },
    ];
  };

  // Helper functions for Step 2 & 3: Batch Exports
  const getAutoflowVisualBatch = () => {
    if (!activeProject?.scenes || activeProject.scenes.length === 0) return '';
    const sorted = [...activeProject.scenes].sort((a, b) => a.scene_order - b.scene_order);
    return sorted.map((s) => {
      const cleanVisual = s.visual_prompt.replace(/[\r\n]+/g, ' ').trim();
      return `Scene ${s.scene_order}: ${cleanVisual} | Character: ${characterName}, ${characterLockPrompt} | Art Style: ${stylePreset}, masterpiece manhwa webtoon style, high contrast, 8k resolution`;
    }).join('\n');
  };

  const getMetaMotionPrompt = (scene: ManhwaScene) => {
    const motion = scene.camera_motion || 'zoom_in';
    const visual = (scene.visual_prompt || '').toLowerCase();
    
    if (motion === 'action' || visual.includes('slash') || visual.includes('attack') || visual.includes('strike') || visual.includes('dagger') || visual.includes('blade')) {
      return 'Dynamic explosive camera push forward, violent surging mana aura, lightning and sparks flying outward, intense anime action choreography, 3D parallax depth, high quality animation';
    }
    if (motion === 'zoom_in') {
      return 'Cinematic slow push in on character, hair and clothes fluttering gently in the breeze, glowing mana embers drifting in dark atmosphere, 3D depth, smooth animation';
    }
    if (motion === 'zoom_out') {
      return 'Epic slow pull-back camera zoom out revealing colossal dark dungeon surroundings, atmospheric fog and dust drifting, dramatic anime depth';
    }
    if (motion === 'pan_left') {
      return 'Smooth horizontal tracking pan left across the scene, cinematic parallax layers, ambient particles floating, high detail animation';
    }
    if (motion === 'pan_right') {
      return 'Smooth horizontal tracking pan right, dynamic parallax layers, glowing energy motes, sharp anime animation';
    }
    if (motion === 'tilt_up') {
      return 'Dramatic towering vertical camera tilt up from ground to ceiling, soaring energy pillars, epic scale reveal, anime lighting';
    }
    if (motion === 'orbital') {
      return 'Cinematic 3D orbital camera arc around character, shifting rim light reflections, floating magic particles, smooth animation';
    }
    return 'Cinematic subtle organic movement, gentle breathing, clothes fluttering slightly in the wind, soft glowing particle drift, anime 3D depth';
  };

  const getMetaMotionBatch = () => {
    if (!activeProject?.scenes || activeProject.scenes.length === 0) return '';
    const sorted = [...activeProject.scenes].sort((a, b) => a.scene_order - b.scene_order);
    return sorted.map((s) => getMetaMotionPrompt(s)).join('\n');
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPackage = () => {
    if (!activeProject) return;
    const data = {
      version: '1.0',
      project_id: activeProject.id,
      title: activeProject.title,
      synopsis: activeProject.synopsis,
      genre: activeProject.genre,
      art_style: activeProject.art_style || stylePreset,
      bgm_preset: bgmPreset,
      total_scenes: activeProject.scenes?.length || 0,
      character: {
        name: characterName,
        appearance_locked_prompt: characterLockPrompt,
        reference_image_url: uploadedCharacterUrl || activeProject.characters?.[0]?.reference_image_url || null,
      },
      scenes: (activeProject.scenes || []).map((s) => ({
        scene_order: s.scene_order,
        narration_text: s.narration_text,
        visual_prompt: s.visual_prompt,
        camera_motion: s.camera_motion,
        meta_motion_prompt: getMetaMotionPrompt(s),
        voice_emotion: s.voice_emotion,
        duration_seconds: s.duration_seconds || 4.5,
      })),
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manhwa_project_${activeProject.id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Fetch projects list
  const fetchProjects = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        if (data.projects && data.projects.length > 0 && !activeProject) {
          loadProjectDetail(data.projects[0].id);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch single project with scenes
  const loadProjectDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveProject(data.project);
        if (data.project.title) setProjectTitle(data.project.title);
        if (data.project.synopsis) setStoryIdea(data.project.synopsis);
        if (data.project.characters && data.project.characters.length > 0) {
          const char = data.project.characters[0];
          if (char.name) setCharacterName(char.name);
          if (char.appearance_locked_prompt) setCharacterLockPrompt(char.appearance_locked_prompt);
          if (char.reference_image_url) setUploadedCharacterUrl(char.reference_image_url);
        }
        if (data.project.scenes) {
          setSceneCount(data.project.scenes.length);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Polling project updates when stitching
  useEffect(() => {
    if (!activeProject?.id) return;
    if (activeProject.status !== 'stitching' && activeProject.video_job?.status !== 'pending_assembly') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${activeProject.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.project) {
            setActiveProject(data.project);
            if (data.project.status === 'completed' || data.project.video_url) {
              setIsAssembling(false);
            }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeProject?.id, activeProject?.status, activeProject?.video_job?.status]);

  const handlePresetChange = (presetName: string) => {
    setStylePreset(presetName);
    if (stylePresets[presetName]) {
      setCharacterLockPrompt(stylePresets[presetName].prompt);
      setBgmPreset(stylePresets[presetName].defaultBgm);
    }
  };

  // Generate Story & Production Steps (Blueprint via LLM)
  const handleGenerateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: projectTitle,
          storyIdea,
          genre: `${stylePreset} (BGM: ${bgmPreset})`,
          characterName,
          characterLockPrompt,
          sceneCount,
          artStyle: stylePreset,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghasilkan blueprint cerita');
      }

      if (data.project) {
        setActiveProject(data.project);
        setProjects((prev) => [data.project, ...prev.filter((p) => p.id !== data.project.id)]);
        setShowStorySetup(false);
        setCurrentStep(1); // Jump into Step 1 of Wizard
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memproses cerita');
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload Master Character Image (Step 1)
  const handleCharacterImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setUploadedCharacterUrl(localUrl);
    setIsUploadingChar(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const projectId = activeProject?.id || 'master_char';
      formData.append('path', `characters/${projectId}_${Date.now()}.png`);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.url) {
          setUploadedCharacterUrl(json.url);
        }
      }
    } catch (err) {
      console.warn('Direct upload error, maintaining local preview:', err);
    } finally {
      setIsUploadingChar(false);
    }
  };

  // Handle Multi-file Video Drop (Step 5)
  const handleVideoClipsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingClips(true);
    const newMap = { ...uploadedClips };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const matchNum = file.name.match(/\d+/);
      const sceneIndex = matchNum ? parseInt(matchNum[0], 10) : i + 1;
      
      const localUrl = URL.createObjectURL(file);
      newMap[sceneIndex] = file.name;

      // Also try uploading to Supabase
      try {
        const formData = new FormData();
        formData.append('file', file);
        const projectId = activeProject?.id || 'temp';
        formData.append('path', `project_clips/${projectId}/scene_${sceneIndex.toString().padStart(3, '0')}.mp4`);
        await fetch('/api/upload', { method: 'POST', body: formData });
      } catch (err) {
        console.warn('Clip upload warning:', err);
      }
    }

    setUploadedClips(newMap);
    setIsUploadingClips(false);
  };

  // Trigger Final Assembly (Step 5)
  const handleTriggerAssemble = async () => {
    if (!activeProject) return;
    setIsAssembling(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: activeProject.id,
          bgm_preset: bgmPreset,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memulai perakitan');

      // Refresh project state
      await loadProjectDetail(activeProject.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memulai assembly');
      setIsAssembling(false);
    }
  };

  // Calculate readiness of clips in Step 5
  const totalRequiredScenes = activeProject?.scenes?.length || sceneCount;
  const verifiedClipsCount = Object.keys(uploadedClips).length;
  const isVideoJobActive = activeProject?.status === 'stitching' || activeProject?.video_job?.status === 'pending_assembly' || isAssembling;
  const isVideoJobComplete = activeProject?.status === 'completed' || !!activeProject?.video_url;

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner / Hero */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-300" />
              <span>Guided Production Wizard • YouTube Recap Workflow</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>AI Manhwa &amp; Anime Recap Studio</span>
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-2xl">
              Alur kerja terstruktur dari ide cerita, loop karakter AutoFlow, batch prompt Meta AI, hingga perakitan video vertikal 1080x1920 siap tayang.
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto">
            <button
              onClick={() => setShowStorySetup(!showStorySetup)}
              className="flex-1 md:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showStorySetup ? 'Tutup Setup Cerita' : 'Buka Setup Cerita'}</span>
              {showStorySetup ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {activeProject && (
              <button
                onClick={handleDownloadPackage}
                className="flex-1 md:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Paket (.json)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-white text-sm font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* 1. Form Input Cerita Utama (Global Setup) */}
      {showStorySetup && (
        <div className="rounded-2xl bg-slate-900/90 border border-indigo-500/20 p-6 shadow-xl backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center space-x-2.5">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/30">
                0
              </span>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Global Setup: Form Input Cerita &amp; Blueprint Sutradara
                </h2>
                <p className="text-[11px] text-slate-400">
                  Masukkan sinopsis atau hasil brainstorming Gemini untuk menghasilkan seluruh adegan cerita dan prompt sinematik.
                </p>
              </div>
            </div>

            {/* Project Switcher */}
            {projects.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-400">Proyek:</span>
                <select
                  value={activeProject?.id || ''}
                  onChange={(e) => loadProjectDetail(e.target.value)}
                  className="bg-slate-950 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-indigo-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title.slice(0, 32)}... ({p.scenes?.length || 0} Scene)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <form onSubmit={handleGenerateStory} className="space-y-5">
            {/* Judul Proyek & Nama Karakter */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Judul Proyek / Episode
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Contoh: Kebangkitan Belati Bayangan: Dendam Kaelen"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Karakter Utama (Protagonis)
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Contoh: Kaelen, Kang Min-Woo, Jin-Woo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Ide Cerita / Sinopsis Besar */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Ide Cerita / Sinopsis / Hasil Brainstorming Gemini
              </label>
              <textarea
                rows={4}
                value={storyIdea}
                onChange={(e) => setStoryIdea(e.target.value)}
                placeholder="Tuliskan atau paste alur cerita lengkap, momen plot twist, musuh utama, dan tensi adegan di sini..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
              />
            </div>

            {/* Preset Gaya Manhwa & Target Jumlah Scene */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Preset Gaya Manhwa
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(stylePresets).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handlePresetChange(key)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition ${
                        stylePreset === key
                          ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-white">{key}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{val.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Jumlah Scene
                </label>
                <div className="space-y-2">
                  <select
                    value={sceneCount}
                    onChange={(e) => setSceneCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value={3}>3 Scenes (Short Teaser)</option>
                    <option value={5}>5 Scenes (Quick TikTok Recap)</option>
                    <option value={10}>10 Scenes (Standard Episode)</option>
                    <option value={20}>20 Scenes (Longform Story)</option>
                    <option value={30}>30 Scenes (Full Chapter Recap)</option>
                    <option value={60}>60 Scenes (Epic Long Movie Recap)</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Sistem akan membagi alur cerita menjadi {sceneCount} adegan kronologis siap visualisasi.
                  </p>
                </div>
              </div>
            </div>

            {/* Tombol Eksekusi Blueprint */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isGenerating || !storyIdea.trim()}
                className="inline-flex items-center space-x-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:opacity-95 text-xs font-bold text-white shadow-xl shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Merancang Storyboard &amp; Prompt Sinematik...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate Story &amp; Production Steps</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. Wizard Stepper Navigation Header */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3 shadow-lg">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { step: 1, title: 'Karakter Master', subtitle: 'AutoFlow Loop', icon: Lock },
            { step: 2, title: 'Visual Prompts', subtitle: 'Batch AutoFlow', icon: ImageIcon },
            { step: 3, title: 'Motion Prompts', subtitle: 'Batch Meta AI', icon: Film },
            { step: 4, title: 'BGM & Narasi', subtitle: 'Edge-TTS Sound', icon: Music },
            { step: 5, title: 'Final Assembly', subtitle: 'Stitch & Output', icon: Clapperboard },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => setCurrentStep(item.step)}
                className={`relative flex items-center space-x-2.5 p-3 rounded-xl border text-left transition ${
                  isActive
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : isDone
                    ? 'bg-slate-950/60 border-slate-800 text-emerald-400 hover:border-slate-700'
                    : 'bg-slate-950/30 border-slate-800/60 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : isDone
                      ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : item.step}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold truncate text-slate-100">{item.title}</div>
                  <div className="text-[10px] text-slate-400 truncate">{item.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: Pembuatan & Penguncian Karakter Master (AutoFlow Character Loop) */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Step Header */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-semibold text-indigo-400 mb-1.5">
                <span>STEP 1 • AUTOFLOW CHARACTER LOOP</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Pembuatan &amp; Penguncian Karakter Master (Character Anchor)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pilih variasi prompt di bawah, paste ke Google Flow / AutoFlow untuk generate contoh gambar. Download 1 gambar terbaik, upload ke sini, lalu kunci karakternya.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsCharacterLocked(!isCharacterLocked)}
                className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition shadow-sm ${
                  isCharacterLocked
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-emerald-500/10'
                    : 'bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-amber-500/10'
                }`}
              >
                {isCharacterLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Karakter Terkunci (LOCKED)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Klik Untuk Mengunci</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => copyToClipboard(characterLockPrompt, 'locked_char')}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/40 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition"
              >
                {copiedType === 'locked_char' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Tersalin ke Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Locked Character Prompt</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Grid: 3-5 Variasi AI Character Prompts + Upload Dropzone */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kolom Kiri: 4 Variasi Prompt Karakter Master */}
            <div className="lg:col-span-2 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>3–5 Variasi Prompt Karakter Master (AutoFlow Engine)</span>
                <span className="text-[11px] font-normal text-slate-500">Pilih salah satu variasi untuk di-generate di Google Flow</span>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {getCharacterVariations().map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{v.title}</span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-medium">
                          {v.badge}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCharacterLockPrompt(v.prompt);
                            setIsCharacterLocked(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-300 transition"
                        >
                          Pilih Jadi Kunci
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(v.prompt, v.id)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-[11px] font-semibold text-white transition"
                        >
                          {copiedType === v.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
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
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">{v.desc}</p>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 leading-relaxed select-all">
                      {v.prompt}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kolom Kanan: Upload / Dropzone Gambar Karakter Master */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Upload Selected Character Image
              </div>

              <div
                onClick={() => charFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-6 bg-slate-900/50 hover:bg-slate-900 flex flex-col items-center justify-center text-center cursor-pointer transition group"
              >
                <input
                  type="file"
                  ref={charFileInputRef}
                  onChange={handleCharacterImageUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />

                {isUploadingChar ? (
                  <div className="py-8 flex flex-col items-center space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                    <span className="text-xs text-slate-300">Mengunggah gambar master ke storage...</span>
                  </div>
                ) : uploadedCharacterUrl ? (
                  <div className="space-y-3 w-full">
                    <div className="relative aspect-[3/4] max-w-[220px] mx-auto rounded-xl overflow-hidden border-2 border-emerald-500/80 shadow-xl shadow-emerald-500/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadedCharacterUrl}
                        alt="Master Character"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 border border-emerald-500 text-[10px] font-mono text-emerald-300">
                        LOCKED
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-400 flex items-center justify-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Karakter Master Terpasang</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">Klik untuk ganti gambar lain</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                      <Upload className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Drop Gambar Master di Sini</div>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Masukkan 1 gambar terbaik hasil generate dari Google Flow / AutoFlow untuk referensi visual.
                      </p>
                    </div>
                    <span className="inline-block px-3 py-1 rounded-lg bg-slate-800 text-[11px] font-medium text-slate-300">
                      Pilih File (PNG / JPG / WEBP)
                    </span>
                  </div>
                )}
              </div>

              {/* Status Box */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-200 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Konsistensi Wajah Terjamin</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Setelah karakter dikunci, prompt paten ini akan disematkan secara otomatis ke seluruh adegan di Step 2.
                </p>
              </div>

              {/* Tombol Lanjut ke Step 2 */}
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                <span>Lanjut ke Step 2: Scene Visual Prompts</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: Scene Visual Prompts (Batch AutoFlow untuk Adegan Cerita) */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Step Header */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[11px] font-semibold text-purple-400 mb-1.5">
                <span>STEP 2 • BATCH SCENE PROMPTS</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Scene Visual Prompts (Batch AutoFlow untuk Adegan Cerita)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Seluruh adegan cerita ({activeProject?.scenes?.length || sceneCount} scene) lengkap dengan narasi bahasa Indonesia dan prompt visual siap paste massal ke AutoFlow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => copyToClipboard(getAutoflowVisualBatch(), 'autoflow_batch')}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition cursor-pointer"
              >
                {copiedType === 'autoflow_batch' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Semua Scene Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All for AutoFlow</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadTextFile(getAutoflowVisualBatch(), `autoflow_prompts_${activeProject?.id?.slice(0, 8) || 'batch'}.txt`)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRawDrawer(!showRawDrawer)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showRawDrawer ? 'Tutup Preview Raw' : 'Lihat Batch Raw'}</span>
              </button>
            </div>
          </div>

          {/* Raw Drawer for AutoFlow */}
          {showRawDrawer && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Raw Batch AutoFlow (1 baris per adegan):</span>
                <span className="text-[10px] text-slate-500">Format siap paste langsung ke ekstensi browser</span>
              </div>
              <textarea
                readOnly
                rows={6}
                value={getAutoflowVisualBatch()}
                className="w-full p-3 rounded-lg bg-black/60 border border-slate-800 font-mono text-[11px] text-emerald-300/90 leading-relaxed focus:outline-none"
              />
            </div>
          )}

          {/* Daftar Adegan Detail (Scene 1 s/d N) */}
          <div className="space-y-4">
            {(!activeProject?.scenes || activeProject.scenes.length === 0) ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  Belum ada adegan cerita yang di-generate. Buka menu &quot;Setup Cerita&quot; di atas lalu klik &quot;Generate Story &amp; Production Steps&quot;.
                </p>
                <button
                  type="button"
                  onClick={() => setShowStorySetup(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
                >
                  Buka Setup Cerita
                </button>
              </div>
            ) : (
              activeProject.scenes.map((scene) => (
                <div
                  key={scene.id || scene.scene_order}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono text-xs font-bold">
                        Scene {scene.scene_order.toString().padStart(2, '0')}
                      </span>
                      <span className="text-xs font-bold text-white">
                        {characterName} • {stylePreset}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(
                        `${scene.visual_prompt} | Character: ${characterName}, ${characterLockPrompt} | Art Style: ${stylePreset}, 8k resolution`,
                        `scene_${scene.scene_order}`
                      )}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
                    >
                      {copiedType === `scene_${scene.scene_order}` ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Scene Prompt</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Teks Narasi Bahasa Indonesia */}
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1.5">
                      <Volume2 className="w-3 h-3" />
                      <span>Narasi Suara (Indonesian Voiceover)</span>
                    </div>
                    <p className="text-xs text-amber-100/90 leading-relaxed font-sans">
                      &quot;{scene.narration_text}&quot;
                    </p>
                  </div>

                  {/* Visual Prompt Box */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Visual Prompt (AutoFlow Ready)
                    </div>
                    <p className="text-xs font-mono text-emerald-300/90 leading-relaxed select-all">
                      {scene.visual_prompt}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Step 1</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <span>Lanjut ke Step 3: Camera Motion Prompts</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: Camera Motion Prompts (Batch Meta AI) */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Step Header */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[11px] font-semibold text-sky-400 mb-1.5">
                <span>STEP 3 • META AI 3D MOTION ENGINE</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Camera Motion Prompts (Batch Meta AI Automation)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Instruksi pergerakan kamera sinematik 3D (crash zoom, pan tracking, aura burst, drifting particles) untuk ekstensi Meta AI.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => copyToClipboard(getMetaMotionBatch(), 'meta_batch')}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-sky-600/20 transition cursor-pointer"
              >
                {copiedType === 'meta_batch' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Semua Motion Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All for Meta Automation</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadTextFile(getMetaMotionBatch(), `meta_motion_${activeProject?.id?.slice(0, 8) || 'batch'}.txt`)}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .txt</span>
              </button>
            </div>
          </div>

          {/* List Motion Prompts per Scene */}
          <div className="space-y-3.5">
            {(!activeProject?.scenes || activeProject.scenes.length === 0) ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                Belum ada adegan. Buka Step 1 &amp; generate cerita terlebih dahulu.
              </div>
            ) : (
              activeProject.scenes.map((scene) => {
                const motionPrompt = getMetaMotionPrompt(scene);
                return (
                  <div
                    key={scene.id || scene.scene_order}
                    className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono text-xs font-bold">
                          Scene {scene.scene_order.toString().padStart(2, '0')}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 uppercase">
                          {scene.camera_motion || 'zoom_in'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => copyToClipboard(motionPrompt, `motion_${scene.scene_order}`)}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition"
                      >
                        {copiedType === `motion_${scene.scene_order}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Motion</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono text-sky-200/90 leading-relaxed select-all">
                      {motionPrompt}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Step 2</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <span>Lanjut ke Step 4: BGM &amp; Soundtrack</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: BGM & Soundtrack Setup */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Step Header */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-400 mb-1.5">
                <span>STEP 4 • AUDIO &amp; SOUNDTRACK ENGINE</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                BGM Preset &amp; Soundtrack Setup
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pilih preset musik latar sinematik atau gunakan prompt AI Music Generator untuk membuat musik orisinal di Suno / Udio.
              </p>
            </div>
          </div>

          {/* Grid Preset BGM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bgmOptions.map((opt) => (
              <div
                key={opt.id}
                onClick={() => setBgmPreset(opt.id as any)}
                className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                  bgmPreset === opt.id
                    ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{opt.icon}</span>
                    {bgmPreset === opt.id && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                        AKTIF
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">{opt.label}</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{opt.desc}</p>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(opt.aiMusicPrompt, `music_${opt.id}`);
                    }}
                    className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 transition"
                  >
                    {copiedType === `music_${opt.id}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Prompt Musik Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Prompt Suno / Udio</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Preview Narasi Suara Edge-TTS per Adegan */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span>Preview Narasi Suara Edge-TTS Bahasa Indonesia</span>
              </div>
              <span className="text-[11px] text-slate-400">Suara: id-ID-ArdiNeural (Dramatic Narration)</span>
            </div>

            <div className="space-y-2.5">
              {activeProject?.scenes?.map((scene) => (
                <div
                  key={scene.id || scene.scene_order}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold">
                      Scene {scene.scene_order.toString().padStart(2, '0')}
                    </span>
                    <span className="text-slate-200 font-medium">
                      &quot;{scene.narration_text}&quot;
                    </span>
                  </div>

                  {scene.audio_url ? (
                    <audio controls src={scene.audio_url} className="h-8 max-w-[220px]" />
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800/50">
                      Word-Timestamps Ready
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Step 3</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(5)}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <span>Lanjut ke Step 5: Final Assembly</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: Final Assembly & Compilation */}
      {/* ========================================================================= */}
      {currentStep === 5 && (
        <div className="space-y-6 animate-fadeIn">
          {/* Step Header */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 mb-1.5">
                <span>STEP 5 • FINAL ASSEMBLY &amp; COMPILATION</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                Perakitan Final Episode (Audio, Kara Subtitles &amp; Video Concat)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Drop kumpulan video klip MP4 dari Meta AI, lalu klik &quot;Assemble Final Episode&quot; untuk mengeksekusi vokal Edge-TTS, subtitle karaoke dinamis, SFX, dan BGM.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchProjects}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync Local Clips</span>
            </button>
          </div>

          {/* Pengamanan Anti-Perakitan Liar Callout */}
          <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-start space-x-3 text-xs text-slate-300">
            <ShieldCheck className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-white">Perlindungan Perakitan Terkontrol:</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Perakitan otomatis liar saat sistem baru dibuka telah dinonaktifkan. Seluruh eksekusi vokal Edge-TTS, subtitle karaoke dinamis (.ass), transisi SFX, dan stitching FFmpeg hanya akan dimulai setelah Anda menekan tombol utama <strong className="text-emerald-300">&quot;Assemble Final Episode&quot;</strong> di bawah.
              </p>
            </div>
          </div>

          {/* Area Dropzone Video MP4 dari Meta AI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div
                onClick={() => videoClipsInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 bg-slate-900/50 hover:bg-slate-900 flex flex-col items-center justify-center text-center cursor-pointer transition group"
              >
                <input
                  type="file"
                  ref={videoClipsInputRef}
                  onChange={handleVideoClipsUpload}
                  multiple
                  accept="video/mp4,video/webm,video/mov"
                  className="hidden"
                />

                {isUploadingClips ? (
                  <div className="py-6 flex flex-col items-center space-y-2">
                    <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                    <span className="text-xs text-slate-300">Mengunggah &amp; mengidentifikasi klip video...</span>
                  </div>
                ) : (
                  <div className="py-6 space-y-2.5">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto group-hover:scale-105 transition">
                      <Video className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">
                        Drop Kumpulan Video MP4 Meta AI di Sini
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm">
                        Pilih sekaligus semua file unduhan dari Meta AI (scene 1 s/d {totalRequiredScenes}). Atau simpan langsung di folder lokal:
                      </p>
                      <code className="mt-2 inline-block px-2.5 py-1 rounded bg-slate-950 font-mono text-[10px] text-emerald-300 border border-slate-800">
                        storage/raw_downloads/{activeProject?.id || 'project_id'}/
                      </code>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Readiness Scene Clips */}
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-white">Status Verifikasi Klip Scene:</span>
                  <span className="text-emerald-400">
                    {verifiedClipsCount}/{totalRequiredScenes} Klip Terdeteksi
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Array.from({ length: totalRequiredScenes }).map((_, idx) => {
                    const scNum = idx + 1;
                    const isReady = !!uploadedClips[scNum];
                    return (
                      <div
                        key={scNum}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          isReady
                            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="font-mono font-semibold">Scene {scNum.toString().padStart(2, '0')}</span>
                        {isReady ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Tombol Utama & Instruksi Assemble */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-4 shadow-xl">
                <div>
                  <h3 className="text-sm font-bold text-white">Eksekusi Final Studio</h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Sistem akan menyatukan suara Edge-TTS, membakar subtitle karaoke dinamis (.ass), menambahkan efek suara transisi (whoosh, slash, impact), dan mixing BGM 3-fase.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTriggerAssemble}
                  disabled={isVideoJobActive}
                  className="w-full inline-flex items-center justify-center space-x-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:opacity-95 text-sm font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  {isVideoJobActive ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Sedang Merakit Final Episode...</span>
                    </>
                  ) : (
                    <>
                      <Clapperboard className="w-4 h-4 text-slate-950" />
                      <span>Assemble Final Episode</span>
                    </>
                  )}
                </button>

                {/* Local Terminal Hint */}
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                  <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Perintah Worker Lokal:</span>
                  </div>
                  <code className="block p-2 rounded bg-black/80 font-mono text-[10px] text-emerald-300 border border-slate-800 select-all">
                    run_auto_ingest.bat
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* Player Video Final Episode (Jika Sudah Selesai) */}
          {(isVideoJobComplete || activeProject?.video_url) && (
            <div className="p-6 rounded-2xl bg-slate-900 border border-emerald-500/40 space-y-4 shadow-2xl animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">
                    Final Episode Siap Tayang (1080x1920 Vertikal)
                  </h3>
                </div>

                {activeProject?.video_url && (
                  <a
                    href={activeProject.video_url}
                    download={`recap_${activeProject.id.slice(0, 8)}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-md shadow-emerald-600/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Final Cut MP4</span>
                  </a>
                )}
              </div>

              {activeProject?.video_url && (
                <div className="max-w-sm mx-auto aspect-[9/16] rounded-xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
                  <video
                    src={activeProject.video_url}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Step 4</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
