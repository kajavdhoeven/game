import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { local } from './backend-local.js';
import { remote } from './backend-supabase.js';

export const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const api = configured ? remote : local;
