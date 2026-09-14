import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      title,
      storyIdea,
      genre = 'Action Fantasy (Solo Leveling Style)',
      characterName = 'Protagonist',
      characterLockPrompt = '1man, solo, messy black hair, glowing blue eyes, sharp jawline, black trench coat, athletic build, high contrast manhwa webtoon art',
      sceneCount = 6,
      artStyle = 'korean_webtoon_hq'
    } = body;

    if (!storyIdea || storyIdea.trim().length === 0) {
      return NextResponse.json({ error: 'Story idea or synopsis is required' }, { status: 400 });
    }

    const routerUrl = process.env.ROUTER_BASE_URL || 'http://127.0.0.1:20128/v1';
    const routerKey = process.env.ROUTER_API_KEY || 'sk-f6d23bb7bbd0260e-v9p3lm-e4eadc94';
    const routerModel = process.env.ROUTER_MODEL || 'COMBO-GEMINI';

    const systemPrompt = `You are a master Korean Webtoon & Anime Recap Storyboard Director.
Your task is to adapt the user's story into a dramatic, high-retention manhwa recap script.
CRITICAL INSTRUCTION:
The main character MUST BE LOCKED consistently in every single scene.
Character Name: "${characterName}"
Locked Appearance Description: "${characterLockPrompt}"

For every scene where the character appears, you MUST weave the locked appearance description into "visual_prompt" along with scene-specific actions, background, and dramatic angles.

Output strictly valid JSON with this exact schema:
{
  "project_title": "Epic Title of the Episode",
  "synopsis": "Short punchy summary",
  "scenes": [
    {
      "scene_order": 1,
      "narration_text": "Indonesian dramatic voiceover text for the recap narration...",
      "dialogue_text": "Optional in-scene dialogue...",
      "visual_prompt": "${characterLockPrompt}, standing amidst ruins, dark ominous sky, glowing particles, extreme close-up, dramatic manhwa angle, 8k",
      "negative_prompt": "text, speech bubble, watermark, low quality, deformed hands, ugly face, extra limbs",
      "camera_motion": "zoom_in",
      "voice_emotion": "dramatic"
    }
  ]
}
Output pure JSON only, no markdown codeblocks, no fluff. Exactly ${sceneCount} scenes.`;

    const userPrompt = `Genre: ${genre}
Story Outline:
${storyIdea}

Create ${sceneCount} dramatic recap scenes. Ensure narration is in engaging, suspenseful Indonesian storytelling voice. Ensure all visual prompts strictly incorporate the locked character appearance.`;

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
        }),
      });

      if (llmRes.ok) {
        const jsonRes = await llmRes.json();
        const rawContent = jsonRes.choices?.[0]?.message?.content || '';
        // Strip markdown backticks if present
        const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        generatedData = JSON.parse(cleaned);
      }
    } catch (llmErr) {
      console.warn('9Router call failed, using deterministic fallback generator:', llmErr);
    }

    // 2. Fallback generator if LLM endpoint unreachable
    if (!generatedData || !Array.isArray(generatedData.scenes)) {
      const defaultTitle = title || `${characterName}: Kebangkitan Sang Penguasa`;
      generatedData = {
        project_title: defaultTitle,
        synopsis: storyIdea,
        scenes: Array.from({ length: sceneCount }).map((_, idx) => ({
          scene_order: idx + 1,
          narration_text: `Adegan ${idx + 1}: Di tengah kehancuran, ${characterName} menyadari kekuatan sejatinya telah bangkit. Tidak ada lagi jalan untuk mundur.`,
          dialogue_text: idx === 0 ? 'Ini baru permulaan...' : undefined,
          visual_prompt: `${characterLockPrompt}, scene ${idx + 1}, dynamic battle pose, glowing aura, rubble and smoke, cinematic angle, high quality manhwa illustration, 8k`,
          negative_prompt: 'text, speech bubble, watermark, low quality, deformed hands, ugly face',
          camera_motion: idx % 2 === 0 ? 'zoom_in' : 'pan_left',
          voice_emotion: idx === 0 ? 'dramatic' : 'intense'
        }))
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

    // Save character
    const { data: charData, error: charErr } = await supabaseAdmin
      .from('manhwa_characters')
      .insert({
        project_id: projectData.id,
        name: characterName,
        role: 'protagonist',
        appearance_locked_prompt: characterLockPrompt,
      })
      .select()
      .single();

    if (charErr) throw charErr;

    // Save scenes
    const sceneRows = generatedData.scenes.map((sc: any, index: number) => ({
      project_id: projectData.id,
      scene_order: index + 1,
      character_id: charData.id,
      character_name: characterName,
      narration_text: sc.narration_text || '',
      dialogue_text: sc.dialogue_text || null,
      visual_prompt: sc.visual_prompt || `${characterLockPrompt}, scene ${index + 1}`,
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
        characters: [charData],
        scenes: insertedScenes,
      }
    });

  } catch (err: any) {
    console.error('Error generating story:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate storyboard' }, { status: 500 });
  }
}
