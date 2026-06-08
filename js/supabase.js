import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = 'https://mysvnjrsbfeltndkjklm.supabase.co'
const SUPABASE_KEY = 'sb_publishable_dYy7dxJMz0ssO_mSJCPctg_cmMu6wkW'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)