
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://plpnypzesupfczxrzgwb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscG55cHplc3VwZmN6eHJ6Z3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0NjAwNDksImV4cCI6MjA4NTAzNjA0OX0.d_sGStyMDts6wUEPOeZQZw8vIpfZMxx78kieGOrzxR8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
