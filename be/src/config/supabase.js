import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mockSupabase, mockSupabaseAdmin } from './supabase.mock.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('Warning: Supabase credentials are not fully configured in your .env file.');
  }
}

// Conditionally export mocked instances or live Supabase connections
export const supabase = process.env.NODE_ENV === 'test'
  ? mockSupabase
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseAnonKey || 'placeholder'
    );

export const supabaseAdmin = process.env.NODE_ENV === 'test'
  ? mockSupabaseAdmin
  : createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseServiceKey || 'placeholder',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

