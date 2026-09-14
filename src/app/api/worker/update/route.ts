import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Local worker updates scene with generated image/audio
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scene_id, status, image_url, audio_url, duration_seconds, error_message } = body;

    const updates: any = {};
    if (status !== undefined) updates.status = status;
    if (image_url !== undefined) updates.image_url = image_url;
    if (audio_url !== undefined) updates.audio_url = audio_url;
    if (duration_seconds !== undefined) updates.duration_seconds = duration_seconds;
    if (error_message !== undefined) updates.error_message = error_message;

    const { data, error } = await supabaseAdmin
      .from('manhwa_scenes')
      .update(updates)
      .eq('id', scene_id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, scene: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
