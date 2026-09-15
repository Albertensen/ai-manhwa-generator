import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface CharacterInput {
  name: string;
  role: 'protagonist' | 'heroine' | 'antagonist' | 'supporting' | 'mentor';
  appearance_locked_prompt: string;
  reference_image_url?: string | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      storyIdea,
      genre = 'Action Fantasy (Solo Leveling Style)',
      productionMode = 'full_motion',
      characters = [],
      characterName = 'Protagonist',
      characterLockPrompt = '1man, solo, messy black hair, glowing blue eyes, sharp jawline, black trench coat, athletic build, high contrast manhwa webtoon art',
      sceneCount = 6,
      artStyle = 'korean_webtoon_hq'
    } = body;

    if (!storyIdea || storyIdea.trim().length === 0) {
      return NextResponse.json({ error: 'Story idea or synopsis is required' }, { status: 400 });
    }

    // Build characters list (support multi-character or legacy single character)
    let charList: CharacterInput[] = [];
    if (Array.isArray(characters) && characters.length > 0) {
      charList = characters.map((c: any) => ({
        name: c.name || 'Character',
        role: c.role || 'supporting',
        appearance_locked_prompt: c.appearance_locked_prompt || c.prompt || characterLockPrompt,
        reference_image_url: c.reference_image_url || null,
      }));
    } else {
      charList = [
        {
          name: characterName,
          role: 'protagonist',
          appearance_locked_prompt: characterLockPrompt,
          reference_image_url: null,
        }
      ];
    }

    const routerUrl = process.env.ROUTER_BASE_URL || 'http://127.0.0.1:20128/v1';
    const routerKey = process.env.ROUTER_API_KEY || 'sk-f6d23bb7bbd0260e-v9p3lm-e4eadc94';
    const routerModel = process.env.ROUTER_MODEL || 'COMBO-GEMINI';

    // Format characters guidance for LLM
    const charactersContext = charList.map((c, i) => 
      `Character ${i + 1}: Name: "${c.name}", Role: ${c.role.toUpperCase()}, Visual Lock: "${c.appearance_locked_prompt}"`
    ).join('\n');

    const systemPrompt = `You are a master Korean Webtoon & Anime Recap Storyboard Director.
Your task is to adapt the user's story into a dramatic, high-retention manhwa recap script.

MULTI-CHARACTER LOCK INSTRUCTIONS:
The following characters exist in the story:
${charactersContext}

For every scene, determine which character(s) appear:
- If Protagonist appears alone, weave Protagonist's visual description into "visual_prompt".
- If a clash/interaction happens (e.g. Protagonist vs Antagonist, or Protagonist + Heroine), include both characters' visual keys clearly in "visual_prompt".
- State the characters present in each scene using the "character_name" field (e.g. "${charList[0]?.name || 'Protagonist'}", or "${charList[0]?.name || 'Protagonist'} & ${charList[1]?.name || 'Antagonist'}").

PRODUCTION MODE: ${productionMode === 'classic_2d' ? 'Classic 2D Manhwa Mode (Focus on crisp static webtoon panels with dynamic framing)' : 'Full-Motion Video Mode (Meta AI 3D Motion)'}

STYLE REQUIREMENTS FOR "visual_prompt":
"high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, dramatic rim lighting, unreal engine 5 render, highly detailed, 8k wallpaper, [Character Locked Prompts for who is present], [scene action & environment], [camera angle]"

NEGATIVE PROMPT REQUIREMENTS:
"ugly, low quality, deformed anatomy, blurry, artifacts, lowres, distorted face, mutated hands, extra fingers, text, speech bubble, watermark"

Output strictly valid JSON with this exact schema:
{
  "project_title": "Epic Title of the Episode",
  "synopsis": "Short punchy summary",
  "scenes": [
    {
      "scene_order": 1,
      "character_name": "${charList[0]?.name || 'Protagonist'}",
      "narration_text": "Indonesian dramatic voiceover text for the recap narration...",
      "dialogue_text": "Optional in-scene dialogue...",
      "visual_prompt": "high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, dramatic rim lighting, unreal engine 5 render, highly detailed, 8k wallpaper, ${charList[0]?.appearance_locked_prompt || ''}, standing amidst ruins, dark ominous sky, glowing particles, extreme close-up, dramatic manhwa angle",
      "negative_prompt": "ugly, low quality, deformed anatomy, blurry, artifacts, lowres, distorted face, mutated hands, extra fingers, text, speech bubble, watermark",
      "camera_motion": "zoom_in",
      "voice_emotion": "dramatic"
    }
  ]
}
Output pure JSON only, no markdown codeblocks, no fluff. Exactly ${sceneCount} scenes.`;

    const userPrompt = `Genre: ${genre}
Production Mode: ${productionMode}
Story Outline:
${storyIdea}

Create ${sceneCount} dramatic recap scenes. Ensure narration is in engaging, suspenseful Indonesian storytelling voice. Incorporate the characters appropriately throughout the scenes.`;

    let generatedData = null;

    // 1. Try calling 9Router LLM
    try {
      const llmRes = await fetch(`${routerUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${routerKey}`,
        },
        body: JSON.stringify({
          model: routerModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          stream: false,
        }),
      });

      if (llmRes.ok) {
        const jsonRes = await llmRes.json();
        const rawContent = jsonRes.choices?.[0]?.message?.content || '';
        const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        generatedData = JSON.parse(cleaned);
      }
    } catch (llmErr) {
      console.warn('9Router call failed, using deterministic fallback generator:', llmErr);
    }

    // 2. Fallback generator if LLM endpoint unreachable
    if (!generatedData || !Array.isArray(generatedData.scenes)) {
      const mc = charList[0] || { name: 'Protagonist', appearance_locked_prompt: characterLockPrompt };
      const ally = charList.find(c => c.role === 'heroine' || c.role === 'supporting') || mc;
      const villain = charList.find(c => c.role === 'antagonist') || mc;

      const defaultTitle = title || `${mc.name}: Kebangkitan Sang Penguasa`;
      generatedData = {
        project_title: defaultTitle,
        synopsis: storyIdea,
        scenes: Array.from({ length: sceneCount }).map((_, idx) => {
          let sceneCharName = mc.name;
          let sceneCharPrompt = mc.appearance_locked_prompt;
          let actionDesc = 'menyadari kekuatan sejatinya telah bangkit di tengah reruntuhan.';

          if (idx === 1 && ally.name !== mc.name) {
            sceneCharName = `${mc.name} & ${ally.name}`;
            sceneCharPrompt = `${mc.appearance_locked_prompt} alongside ${ally.appearance_locked_prompt}`;
            actionDesc = `bertemu dengan ${ally.name}, bersumpah untuk menembus lantai dungeon bersama.`;
          } else if (idx === 2 && villain.name !== mc.name) {
            sceneCharName = villain.name;
            sceneCharPrompt = villain.appearance_locked_prompt;
            actionDesc = `Sosok ${villain.name} muncul memancarkan aura kehancuran yang mengerikan.`;
          } else if (idx >= 3 && villain.name !== mc.name) {
            sceneCharName = `${mc.name} vs ${villain.name}`;
            sceneCharPrompt = `${mc.appearance_locked_prompt} clashing weapons against ${villain.appearance_locked_prompt}`;
            actionDesc = `terlibat dalam pertempuran hidup dan mati yang mengguncang seluruh arena.`;
          }

          return {
            scene_order: idx + 1,
            character_name: sceneCharName,
            narration_text: `Adegan ${idx + 1}: Di tengah tensi yang memuncak, ${sceneCharName} ${actionDesc}`,
            dialogue_text: idx === 0 ? 'Ini baru permulaan...' : undefined,
            visual_prompt: `high-end cinematic manhwa style, crisp lineart, digital illustration, trending on webtoon, dramatic rim lighting, unreal engine 5 render, highly detailed, 8k wallpaper, ${sceneCharPrompt}, scene ${idx + 1}, dynamic tension, glowing aura, rubble and smoke, cinematic angle`,
            negative_prompt: 'ugly, low quality, deformed anatomy, blurry, artifacts, lowres, distorted face, mutated hands, extra fingers, text, speech bubble, watermark',
            camera_motion: idx % 2 === 0 ? 'zoom_in' : 'pan_left',
            voice_emotion: idx === 0 ? 'dramatic' : 'intense'
          };
        })
      };
    }

    // 3. Save to Supabase (isolated manhwa_* tables)
    const { data: projectData, error: projErr } = await supabaseAdmin
      .from('manhwa_projects')
      .insert({
        title: generatedData.project_title || title || 'Untitled Manhwa Project',
        synopsis: generatedData.synopsis || storyIdea,
        genre,
        art_style: artStyle,
        status: 'story_ready',
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // Save all characters
    const charRows = charList.map(c => ({
      project_id: projectData.id,
      name: c.name,
      role: c.role,
      appearance_locked_prompt: c.appearance_locked_prompt,
      reference_image_url: c.reference_image_url || null,
    }));

    const { data: insertedChars, error: charsErr } = await supabaseAdmin
      .from('manhwa_characters')
      .insert(charRows)
      .select();

    if (charsErr) throw charsErr;

    const primaryChar = insertedChars?.[0] || { id: null, name: characterName };

    // Save scenes
    const sceneRows = generatedData.scenes.map((sc: any, index: number) => ({
      project_id: projectData.id,
      scene_order: index + 1,
      character_id: primaryChar.id,
      character_name: sc.character_name || primaryChar.name,
      narration_text: sc.narration_text || '',
      dialogue_text: sc.dialogue_text || null,
      visual_prompt: sc.visual_prompt || `${primaryChar.appearance_locked_prompt}, scene ${index + 1}`,
      negative_prompt: sc.negative_prompt || 'text, speech bubble, watermark, low quality',
      camera_motion: sc.camera_motion || 'zoom_in',
      voice_emotion: sc.voice_emotion || 'dramatic',
      status: 'pending',
    }));

    const { data: insertedScenes, error: scenesErr } = await supabaseAdmin
      .from('manhwa_scenes')
      .insert(sceneRows)
      .select();

    if (scenesErr) throw scenesErr;

    return NextResponse.json({
      success: true,
      project: {
        ...projectData,
        characters: insertedChars,
        scenes: insertedScenes,
      }
    });

  } catch (err: any) {
    console.error('Error generating story:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate storyboard' }, { status: 500 });
  }
}
