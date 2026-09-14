'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Lock, 
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
  Trash2
} from 'lucide-react';
import { ManhwaProject, ManhwaScene } from '@/lib/types';

export default function StudioPage() {
  // Form state
  const [characterName, setCharacterName] = useState('Kang Min-Woo');
  const [characterLockPrompt, setCharacterLockPrompt] = useState(
    '1man, solo, messy black parted hair, glowing electric blue eyes, sharp jawline, athletic silhouette, black hooded long coat with glowing purple mana aura, high contrast manhwa art style, sharp lineart, 8k masterpiece'
  );
  const [stylePreset, setStylePreset] = useState('Solo Leveling / Dark Fantasy');
  const [storyIdea, setStoryIdea] = useState(
    'Setelah 10 tahun terjebak di dungeon peringkat terendah, sebuah jendela sistem misterius muncul di hadapannya. Peringkatnya melonjak dari E-rank menjadi Penguasa Bayangan, dan monster bos pertama tunduk di bawah kakinya.'
  );
  const [sceneCount, setSceneCount] = useState(5);
  
  // App state
  const [isGenerating, setIsGenerating] = useState(false);
  const [projects, setProjects] = useState<ManhwaProject[]>([]);
  const [activeProject, setActiveProject] = useState<ManhwaProject | null>(null);
  const [selectedScene, setSelectedScene] = useState<ManhwaScene | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Presets mapping
  const stylePresets: Record<string, { prompt: string; desc: string }> = {
    'Solo Leveling / Dark Fantasy': {
      prompt: '1man, solo, messy black parted hair, glowing electric blue eyes, sharp jawline, black long coat, dark purple shadow aura, solo leveling art style, dramatic rim lighting, 8k',
      desc: 'Dark shadows, glowing blue/purple aura, intense sharp eyes'
    },
    'Omniscient Reader / Modern Hunter': {
      prompt: '1man, solo, neat dark hair, determined obsidian eyes, white trench coat over formal dark suit, modern seoul apocalypse background, webtoon clean lineart, vibrant colors',
      desc: 'White trenchcoat, modern apocalypse hunter, clean manhwa colors'
    },
    'Murim / Heavenly Demon Cultivation': {
      prompt: '1man, solo, long flowing jet-black hair tied in topknot, crimson glowing eyes, ornate martial arts robes with silver dragon embroidery, floating martial aura, ancient pagoda ruins',
      desc: 'Traditional martial robes, flowing hair, ancient murim aesthetic'
    },
    'Villainess / Imperial Noblesse': {
      prompt: '1girl, solo, long wavy platinum blonde hair, piercing amethyst violet eyes, opulent emerald embroidered royal gown, gold jewelry, grand baroque palace ballroom, soft dramatic glow',
      desc: 'Royal elegance, opulent palace background, lavish webtoon romance'
    }
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
        if (data.project.scenes && data.project.scenes.length > 0) {
          setSelectedScene(data.project.scenes[0]);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handlePresetChange = (presetName: string) => {
    setStylePreset(presetName);
    if (stylePresets[presetName]) {
      setCharacterLockPrompt(stylePresets[presetName].prompt);
    }
  };

  // Generate Story & Lock Characters
  const handleGenerateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/story/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyIdea,
          genre: stylePreset,
          characterName,
          characterLockPrompt,
          sceneCount,
          artStyle: stylePreset,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate storyboard');
      }

      if (data.project) {
        setActiveProject(data.project);
        if (data.project.scenes?.length > 0) {
          setSelectedScene(data.project.scenes[0]);
        }
        await fetchProjects();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred during generation');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>Character Consistency Engine Active</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              AI Manhwa Recap Studio
            </h2>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Lock visual traits across all panels. Adapt text into episodic webtoon storyboards with automated TTS voicing and dynamic pan-and-zoom video assembly.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchProjects}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Sync Cloud</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-center space-x-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl bg-[#0f131d] border border-slate-800/80 p-6 shadow-xl">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2 mb-4">
              <Lock className="w-4 h-4 text-indigo-400" />
              <span>1. Character Appearance Lock</span>
            </h3>

            <form onSubmit={handleGenerateStory} className="space-y-4">
              {/* Preset Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Manhwa Style Preset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(stylePresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetChange(preset)}
                      className={`px-3 py-2 rounded-lg text-left text-xs font-medium border transition ${
                        stylePreset === preset
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-semibold">{preset.split('/')[0]}</div>
                      <div className="text-[10px] text-slate-500 truncate">{preset.split('/')[1] || ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Character Name */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Character Name (Nama Karakter)
                </label>
                <input
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="e.g. Sung Jin-Woo / Kang Min-Woo"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Locked Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-400">
                    Locked Visual Prompt (Ciri Fisik Terkunci)
                  </label>
                  <span className="text-[10px] text-indigo-400 font-mono">Ditanam di tiap scene</span>
                </div>
                <textarea
                  rows={4}
                  value={characterLockPrompt}
                  onChange={(e) => setCharacterLockPrompt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                  required
                />
              </div>

              <div className="border-t border-slate-800/80 pt-4 mt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2 mb-3">
                  <Clapperboard className="w-4 h-4 text-violet-400" />
                  <span>2. Story Outline & Script</span>
                </h3>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Ide Alur / Sinopsis Cerita
                  </label>
                  <textarea
                    rows={4}
                    value={storyIdea}
                    onChange={(e) => setStoryIdea(e.target.value)}
                    placeholder="Tulis ringkasan cerita atau beat chapter di sini..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    required
                  />
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-400">
                    Target Scene / Panel Count
                  </label>
                  <div className="flex items-center space-x-1.5">
                    {[3, 5, 8, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSceneCount(num)}
                        className={`w-8 h-8 rounded-lg text-xs font-mono font-bold transition border ${
                          sceneCount === num
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/25 border border-indigo-400/30 flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Merajut Storyboard & Mengunci Karakter...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Buat Storyboard & Lock Karakter</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Project History Switcher */}
          {projects.length > 0 && (
            <div className="rounded-2xl bg-[#0f131d] border border-slate-800/80 p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Saved Projects ({projects.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProjectDetail(p.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition border flex items-center justify-between ${
                      activeProject?.id === p.id
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-white truncate">{p.title}</div>
                      <div className="text-[10px] text-slate-500">{new Date(p.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {p.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Storyboard Panels & Director (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl bg-[#0f131d] border border-slate-800/80 p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Storyboard Timeline</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeProject ? activeProject.title : 'Belum ada proyek terpilih'}
                </p>
              </div>

              {activeProject && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-mono">
                    {activeProject.scenes?.length || 0} Panels
                  </span>
                </div>
              )}
            </div>

            {/* Scenes Timeline */}
            <div className="mt-6 space-y-4">
              {!activeProject || !activeProject.scenes || activeProject.scenes.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <Clapperboard className="w-12 h-12 mx-auto mb-3 text-slate-700" />
                  <p className="text-sm font-medium">Belum ada storyboard.</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Isi form di sebelah kiri untuk menghasilkan skrip manhwa dan panel adegan.
                  </p>
                </div>
              ) : (
                activeProject.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    onClick={() => setSelectedScene(scene)}
                    className={`rounded-xl border p-4 transition cursor-pointer ${
                      selectedScene?.id === scene.id
                        ? 'bg-slate-800/70 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-bold flex items-center justify-center">
                          {scene.scene_order}
                        </span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Scene {scene.scene_order}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                          {scene.camera_motion}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-violet-300 border border-slate-700">
                          {scene.voice_emotion}
                        </span>
                        <span className={`px-2 py-0.5 rounded border ${
                          scene.status === 'ready' 
                            ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                            : 'bg-amber-950/60 border-amber-700 text-amber-300'
                        }`}>
                          {scene.status}
                        </span>
                      </div>
                    </div>

                    {/* Narration script */}
                    <div className="bg-black/30 rounded-lg p-2.5 border border-slate-800/60 my-2">
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 font-mono mb-1">
                        <Volume2 className="w-3 h-3 text-slate-500" />
                        <span>Narration Voiceover:</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed italic">
                        "{scene.narration_text}"
                      </p>
                    </div>

                    {/* Visual Prompt preview */}
                    <div className="bg-black/20 rounded-lg p-2.5 border border-slate-800/40 text-[11px] font-mono text-slate-400 leading-relaxed">
                      <span className="text-indigo-400 font-semibold">Prompt: </span>
                      {scene.visual_prompt}
                    </div>

                    {/* Media attachments if rendered */}
                    {(scene.image_url || scene.audio_url) && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
                        {scene.image_url ? (
                          <div className="flex items-center space-x-2 text-xs text-emerald-400">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>Panel Rendered</span>
                          </div>
                        ) : null}

                        {scene.audio_url ? (
                          <div className="flex items-center space-x-2 text-xs text-indigo-400">
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Audio Voiced</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Local Pipeline Runner Status */}
            {activeProject && activeProject.scenes && activeProject.scenes.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-800">
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                      <Film className="w-4 h-4 text-indigo-400" />
                      <span>Local Studio Bridge (RTX 3060 Ti)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jalankan skrip worker lokal untuk merender panel dengan ComfyUI dan menggabungkan video.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <code className="px-2.5 py-1.5 rounded-lg bg-black/60 border border-slate-700 text-[11px] text-indigo-300 font-mono">
                      python backend/worker.py
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
