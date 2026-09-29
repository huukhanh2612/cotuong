import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
export const hasSupabase=!!(url&&key);
export const sb=hasSupabase?createClient(url,key):null;
