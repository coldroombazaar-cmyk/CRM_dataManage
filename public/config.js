// config.js - API Configuration
// Change API_BASE_URL to your Railway backend URL when deployed

const API_BASE_URL = 
  // For local development:
  window.location.hostname === 'localhost' 
    ? 'http://localhost:3000'
    // For Netlify production (replace with your Railway URL):
    : 'https://your-backend-url.railway.app';

console.log('API Base URL:', API_BASE_URL);

// Export for use in other scripts
window.API_CONFIG = { API_BASE_URL };
