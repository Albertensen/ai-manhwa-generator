import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Local worker calls GET to fetch pending scenes to render/voice
export async function GET() {
  try {
    const { data: scenes, error } = await supabaseAdmin
      .from('manhwa_scenes')
      .select('*, manhwa_projects(title, art_style), manhwa_characters(appearance_locked_prompt)')
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(5);

    if (error) throw error;
    return NextResponse.json({ queue: scenes || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
