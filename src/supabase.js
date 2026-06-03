import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://njvxjuhdssiapqmwhrrn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdnhqdWhkc3NpYXBxbXdocnJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMTAwODYsImV4cCI6MjA5NTg4NjA4Nn0.hnc2Ud4yEGY5MnO4_R_n5m0km8nhuNYxZ8RAdHWmjOk'

export const supabase = createClient(supabaseUrl, supabaseKey)