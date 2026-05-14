const fs = require('fs');

const config = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCLNz6ceFs5MNahOa4wJIHVJTPBpDldCes'
};

const js = `window.GOLF_APP_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
fs.writeFileSync('config.js', js);
console.log('Wrote config.js');
console.log(`Supabase configured: ${Boolean(config.supabaseUrl && config.supabaseAnonKey)}`);
console.log(`Google Maps configured: ${Boolean(config.googleMapsApiKey)}`);
