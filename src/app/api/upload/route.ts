import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customPath = formData.get('path') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const filePath = customPath || `uploads/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { data, error } = await supabaseAdmin.storage
      .from('manhwa-assets')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw error;
    }

    const { data: publicData } = supabaseAdmin.storage
      .from('manhwa-assets')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      path: filePath,
      url: publicData.publicUrl,
    });
  } catch (err: any) {
    console.error('API /upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}
