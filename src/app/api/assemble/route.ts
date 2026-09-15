import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { project_id, bgm_preset } = await req.json();

    if (!project_id) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    // 1. Update project status
    const { data: project, error: projErr } = await supabaseAdmin
      .from('manhwa_projects')
      .update({
        status: 'stitching',
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
          status: 'pending_assembly',
          progress_percent: 15,
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
          status: 'pending_assembly',
          progress_percent: 15,
        })
        .select()
        .single();
      if (jobErr) throw jobErr;
      job = newJob;
    }

    return NextResponse.json({
      success: true,
      message: 'Assembly job registered. Auto-Ingest worker will compile clips with subtitles, SFX, and BGM.',
      project,
      job,
    });
  } catch (err: any) {
    console.error('API /assemble error:', err);
    return NextResponse.json({ error: err.message || 'Failed to trigger assembly' }, { status: 500 });
  }
}
