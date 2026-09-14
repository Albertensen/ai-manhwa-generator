import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: project, error: projErr } = await supabaseAdmin
      .from('manhwa_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projErr) throw projErr;

    const { data: characters } = await supabaseAdmin
      .from('manhwa_characters')
      .select('*')
      .eq('project_id', id);

    const { data: scenes } = await supabaseAdmin
      .from('manhwa_scenes')
      .select('*')
      .eq('project_id', id)
      .order('scene_order', { ascending: true });

    const { data: videoJobs } = await supabaseAdmin
      .from('manhwa_video_jobs')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestJob = videoJobs?.[0] || null;

    return NextResponse.json({
      project: {
        ...project,
        characters: characters || [],
        scenes: scenes || [],
        video_job: latestJob,
        video_url: latestJob?.video_url || null,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await supabaseAdmin
      .from('manhwa_projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
