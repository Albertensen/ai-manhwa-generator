import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { project_id, bgm_preset } = await req.json();

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // 1. Update project status in Supabase
    const { data: project, error: projErr } = await supabaseAdmin
      .from('manhwa_projects')
      .update({
        status: 'rendering',
        updated_at: new Date().toISOString(),
      })
      .eq('id', project_id)
      .select()
      .single();

    if (projErr) throw projErr;

    // 2. Check or create video job
    const { data: existingJobs } = await supabaseAdmin
      .from('manhwa_video_jobs')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1);

    let job;
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
          project_id,
          status: 'rendering',
          progress_percent: 20,
        })
        .select()
        .single();
      if (jobErr) throw jobErr;
      job = newJob;
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
    
    let pythonBin = 'python';
    for (const cand of pythonCandidates) {
      if (fs.existsSync(cand)) {
        pythonBin = cand;
        break;
      }
    }

    const cliArgs = [rendererScript, '--project-id', project_id];
    if (bgm_preset) {
      cliArgs.push('--bgm-preset', bgm_preset);
    }
    const cliCommandStr = `python backend/remotion_renderer.py --project-id ${project_id}${bgm_preset ? ` --bgm-preset ${bgm_preset}` : ''}`;

    if (fs.existsSync(rendererScript)) {
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
      console.warn(`[API /render/remotion] Script ${rendererScript} not found on local disk. Job registered in Supabase queue.`);
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
