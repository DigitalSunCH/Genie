import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kltkvqvlaklyrbjxffuk.supabase.co'

// Admin Client für Server-only Operationen (mit Service Role Key)
// NUR in API Routes, Server Actions, etc. verwenden!
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

