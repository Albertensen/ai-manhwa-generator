import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: projects, error } = await supabaseAdmin
      .from('manhwa_projects')
      .select('*, manhwa_characters(*), manhwa_scenes(*), manhwa_video_jobs(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Map latest video_url directly for UI convenience
    const formattedProjects = (projects || []).map((p: any) => {
      const jobs = p.manhwa_video_jobs || [];
      const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;
      return {
        ...p,
        video_url: latestJob?.video_url || null,
        video_job: latestJob
      };
    });

    return NextResponse.json({ projects: formattedProjects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
