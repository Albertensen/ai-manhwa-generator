import { createClient } from '@supabase/supabase-js';

const defaultUrl = 'https://yegyiqyqtcbvjjqxvyto.supabase.co';
const defaultAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZ3lpcXlxdGNidmpqcXh2eXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTI4ODIsImV4cCI6MjEwNDY4ODg4Mn0.ivYDlp7OYC8dyQV_igngOZKhMqtmcWTbjk34m30hgGs';
const defaultService = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllZ3lpcXlxdGNidmpqcXh2eXRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTExMjg4MiwiZXhwIjoyMTA0Njg4ODgyfQ.s5XlY4qjzXbjx4SfVqjdgyHP108Vtb_f9ucxtVtPK60';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnon;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || defaultService;

// Client-side instance (restricted by RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side / Admin instance (full access for API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
