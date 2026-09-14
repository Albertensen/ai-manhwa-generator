import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yegyiqyqtcbvjjqxvyto.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Client-side instance (restricted by RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side / Admin instance (full access for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
