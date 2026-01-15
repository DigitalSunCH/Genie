import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kltkvqvlaklyrbjxffuk.supabase.co'

// Client für Browser/Client Components (mit Anon Key)
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

