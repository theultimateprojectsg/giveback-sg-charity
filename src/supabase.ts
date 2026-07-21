import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yohlxtnyeisrfxjnmzjd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvaGx4dG55ZWlzcmZ4am5tempkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTAxMzEsImV4cCI6MjA5OTE2NjEzMX0.9sHHlj4guSifS0PteDM2aVhXqiHVMYPOWnlnrCMKmNQ'

export const supabase = createClient(supabaseUrl, supabaseKey)