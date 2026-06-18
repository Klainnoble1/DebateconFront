import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anon key only — safe for the browser. All writes to queue/session tables
// happen server-side via the signaling server's service role key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
