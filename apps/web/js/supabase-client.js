import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL='https://grlifamrkdoffglvrttu.supabase.co'
const SUPABASE_KEY='sb_publishable_NlFza1aVKzhWh2Xiwm0VGQ_wI1aPdTN'

export const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
})
