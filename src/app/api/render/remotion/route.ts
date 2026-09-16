import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const projectId = body.project_id || body.projectId;
    const bgm_preset = body.bgm_preset || body.bgmPreset || 'epic_battle';

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(projectId);

    let project: any = null;
    let job: any = null;

    if (isUuid) {
      // 1. Update project status in Supabase if valid UUID
      const { data: projData, error: projErr } = await supabaseAdmin
        .from('manhwa_projects')
        .update({
          status: 'rendering',
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .select()
        .single();

      if (!projErr && projData) {
        project = projData;
      }

      // 2. Check or create video job
      const { data: existingJobs } = await supabaseAdmin
        .from('manhwa_video_jobs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingJobs && existingJobs.length > 0) {
        const { data: updatedJob, error: jobErr } = await supabaseAdmin
          .from('manhwa_video_jobs')
          .update({
            status: 'rendering',
            progress_percent: 20,
            video_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingJobs[0].id)
          .select()
          .single();
        if (jobErr) throw jobErr;
        job = updatedJob;
      } else {
        const { data: newJob, error: jobErr } = await supabaseAdmin
          .from('manhwa_video_jobs')
          .insert({
            project_id: projectId,
            status: 'rendering',
            progress_percent: 20,
          })
          .select()
          .single();
        if (jobErr) throw jobErr;
        job = newJob;
      }
    } else {
      project = { id: projectId, title: 'Demo / Local Project', status: 'rendering' };
      job = { id: 'local_job_' + Date.now(), project_id: projectId, status: 'rendering', progress_percent: 20 };
    }

    // 3. Trigger local Remotion render process if in local environment
    const rootDir = process.cwd();
    const rendererScript = path.join(rootDir, 'backend', 'remotion_renderer.py');
    
    // Check python candidates
    const pythonCandidates = [
      'C:\\ComfyUI\\.venv\\Scripts\\python.exe',
      'python',
      'python3',
    ];
    
    const cliArgs = [rendererScript, '--project-id', projectId];
    if (bgm_preset) {
      cliArgs.push('--bgm-preset', bgm_preset);
    }
    const cliCommandStr = `python backend/remotion_renderer.py --project-id ${projectId}${bgm_preset ? ` --bgm-preset ${bgm_preset}` : ''}`;

    if (!process.env.VERCEL) {
      try {
        let pythonBin = 'python';
        for (const cand of pythonCandidates) {
          if (fs.existsSync(/* turbopackIgnore: true */ cand)) {
            pythonBin = cand;
            break;
          }
        }

        if (fs.existsSync(/* turbopackIgnore: true */ rendererScript)) {
          console.log(`[API /render/remotion] Spawning renderer: ${pythonBin} ${cliArgs.join(' ')}`);
          const child = spawn(
            pythonBin,
            cliArgs,
            {
              cwd: rootDir,
              detached: true,
              stdio: 'ignore',
              shell: true,
            }
          );
          child.unref();
        } else {
          console.warn(`[API /render/remotion] Script not found locally. Job queued in Supabase.`);
        }
      } catch (spawnErr) {
        console.warn('[API /render/remotion] Local spawn skipped:', spawnErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Remotion 2.5D rendering initiated. Parallax scenes, cutouts, and kinetic captions are compiling.',
      project,
      job,
      command: cliCommandStr,
    });
  } catch (err: any) {
    console.error('API /render/remotion error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to trigger Remotion render' },
      { status: 500 }
    );
  }
}
