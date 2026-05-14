const CFG = (typeof window !== 'undefined' && window.GOLF_APP_CONFIG) || {};

export const HARDCODED_MAPS_KEY = 'AIzaSyCLNz6ceFs5MNahOa4wJIHVJTPBpDldCes';

export const SUPABASE_URL = CFG.supabaseUrl || '';
export const SUPABASE_ANON_KEY = CFG.supabaseAnonKey || '';
export const GOOGLE_MAPS_API_KEY = CFG.googleMapsApiKey || HARDCODED_MAPS_KEY;
export const STORAGE_KEY = 'strategico-golf-tablet-scorecard-v2';
export const MAPS_KEY_STORAGE = STORAGE_KEY + ':mapsKey';
export const PAARL_CENTER = { lat: -33.7546, lng: 18.9706 };

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
