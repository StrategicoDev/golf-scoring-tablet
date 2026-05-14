const CFG = (typeof window !== 'undefined' && window.GOLF_APP_CONFIG) || {};

export const SUPABASE_URL = CFG.supabaseUrl || '';
export const SUPABASE_ANON_KEY = CFG.supabaseAnonKey || '';
export const GOOGLE_MAPS_API_KEY = CFG.googleMapsApiKey || '';
export const STORAGE_KEY = 'strategico-golf-tablet-scorecard-v2';
export const MAPS_KEY_STORAGE = STORAGE_KEY + ':mapsKey';
export const PAARL_CENTER = { lat: -33.7546, lng: 18.9706 };

export const DEFAULT_HOLES = Array.from({ length: 18 }, (_, i) => {
  const offset = (i % 6) * 0.00028;
  return {
    number: i + 1,
    par: [5,4,3,4,4,5,3,4,4,4,5,3,4,4,5,3,4,4][i],
    strokeIndex: [8,14,18,2,10,4,16,6,12,7,1,17,5,11,3,15,9,13][i],
    tee:   { x: 50, y: 78, lat: PAARL_CENTER.lat - 0.00105 + offset, lng: PAARL_CENTER.lng - 0.00012 },
    green: { x: 50, y: 15, lat: PAARL_CENTER.lat + 0.00105 + offset, lng: PAARL_CENTER.lng + 0.00012 },
    layup: null,
    you:   { x: 56, y: 87, lat: PAARL_CENTER.lat - 0.00132 + offset, lng: PAARL_CENTER.lng + 0.00018 }
  };
});

export function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
