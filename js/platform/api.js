import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { local } from './backend-local.js';
import { remote } from './backend-supabase.js';

// Met ?demo (of localStorage 'teun-demo') draait het platform zonder Supabase, met accounts in deze browser.
let demo = false;
try { demo = new URLSearchParams(location.search).has('demo') || localStorage.getItem('teun-demo') === '1'; } catch (e) { /* geen opslag */ }

export const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY) && !demo;
export const api = configured ? remote : local;
