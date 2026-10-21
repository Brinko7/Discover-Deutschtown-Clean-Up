// The one place the backend settings live (web page keeps its own copy at the top of its script).
// The publishable key is safe to ship ONLY because row level security is on for every table.
// Never put the secret key, the service_role key, or the database password here.
export const SUPABASE_URL = 'https://qcdlqavkmnojftlysxxt.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_trVkqZ9c9I1jPNXMWaaFwQ_PpTuIsnv';

// The link people get when they tap Share. This is the live web version until the store pages exist.
// Replace with the App Store / Google Play link once the app is public.
export const SHARE_URL = 'https://brinko7.github.io/Discover-Deutschtown-Clean-Up/clean-east-allegheny-Github-initial.html';
