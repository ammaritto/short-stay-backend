const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const availabilityRoutes = require('./src/routes/availability');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Add availability routes
app.use('/api/availability', availabilityRoutes);

// Test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    hasCredentials: {
      username: !!process.env.RH_USERNAME,
      password: !!process.env.RH_PASSWORD,
      authUrl: !!process.env.RH_AUTH_URL,
      baseUrl: !!process.env.RH_BASE_URL
    }
  });
});

app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint working!',
    env: process.env.NODE_ENV
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

module.exports = app;
