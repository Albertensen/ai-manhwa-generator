import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data: projects, error } = await supabaseAdmin
      .from('manhwa_projects')
      .select('*, manhwa_characters(*), manhwa_scenes(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ projects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
