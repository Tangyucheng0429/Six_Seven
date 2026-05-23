import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import dotenv from 'dotenv';
import { mockSupabase, mockSupabaseAdmin } from './supabase.mock.js';

const realtimeOptions = { realtime: { transport: ws } };

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.NODE_ENV !== 'test') {
  if (!supabaseUrl) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_URL is missing in your .env file.');
  }
  if (supabaseUrl.includes('your-project-id')) {
    throw new Error(
      'CRITICAL CONFIG ERROR: SUPABASE_URL is still the placeholder. Set it in be/.env to https://<project-ref>.supabase.co from your Supabase dashboard.',
    );
  }
  if (!supabaseAnonKey) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_ANON_KEY is missing in your .env file.');
  }
  if (!supabaseServiceKey) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY is missing in your .env file.');
  }
}

// Conditionally export mocked instances or live Supabase connections
export const supabase = process.env.NODE_ENV === 'test'
  ? mockSupabase
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder',
      realtimeOptions,
    );

export const supabaseAdmin = process.env.NODE_ENV === 'test'
  ? mockSupabaseAdmin
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseServiceKey || 'placeholder',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        ...realtimeOptions,
      },
    );

