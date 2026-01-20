const fs = require('fs');
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
