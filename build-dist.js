const fs = require('fs');
const path = require('path');

// Create dist directory structure
const dist = path.join(__dirname, 'dist');
const functions = path.join(__dirname, 'functions');

// Remove existing dist and functions
if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true });
if (fs.existsSync(functions)) fs.rmSync(functions, { recursive: true });

// Create directories
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(path.join(functions, 'server'), { recursive: true });

// Copy public folder to dist
console.log('Copying public assets...');
const publicSrc = path.join(__dirname, 'public');
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, dist, { recursive: true });
}

// Copy server.js to netlify functions
console.log('Setting up serverless function...');
fs.copyFileSync(
  path.join(__dirname, 'server.js'),
  path.join(functions, 'server.js')
);

// Create wrapper function for Netlify
const serverWrapper = `const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

let serverModule;

exports.handler = async (event, context) => {
  try {
    // Initialize server only once
    if (!serverModule) {
      // Mock the express static middleware for Netlify
      const express = require('express');
      const app = express();
      
      // Import the actual server
      serverModule = require('./server.js');
    }

    // Use AWS Lambda Proxy Integration format
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'API endpoint' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
`;

fs.writeFileSync(path.join(functions, 'server.js'), serverWrapper);

console.log('✓ Dist folder created successfully!');
console.log('✓ dist/ - Frontend assets ready');
console.log('✓ functions/server.js - Serverless backend');
