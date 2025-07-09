const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const availabilityRoutes = require('./src/routes/availability');
const bookingRoutes = require('./src/routes/booking');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for payment data
app.use(express.urlencoded({ extended: true }));

// Add availability routes
app.use('/api/availability', availabilityRoutes);

// Add booking routes (both legacy and new payment routes)
app.use('/api/booking', bookingRoutes);

// Test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Short Stay Booking API is working!',
    timestamp: new Date().toISOString(),
    version: '2.1.0', // Updated version
    features: [
      'Property availability search',
      'Booking creation (legacy)',
      'Booking creation with payment processing (NEW FLOW)',
      'Payment management',
      'Invoice posting',
      'Room stays retrieval'
    ]
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    hasCredentials: {
      clientId: !!process.env.RH_CLIENT_ID,
      clientSecret: !!process.env.RH_CLIENT_SECRET,
      authUrl: !!process.env.RH_AUTH_URL,
      baseUrl: !!process.env.RH_BASE_URL,
      scope: process.env.RH_SCOPE || 'api/read api/write'
    },
    features: {
      availability: true,
      booking: true,
      payment: true,
      invoicePosting: true,
      roomStaysRetrieval: true
    }
  });
});

app.get('/test', (req, res) => {
  res.json({ 
    message: 'Test endpoint working!',
    env: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// API documentation route
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'Short Stay Booking API Documentation',
    endpoints: {
      availability: {
        'GET /api/availability/search': 'Search for available properties',
        'GET /api/availability/health': 'Availability service health check'
      },
      booking: {
        'POST /api/booking/create': 'Create booking (legacy - enquiry only)',
        'POST /api/booking/create-with-payment': 'Create booking with payment (NEW FLOW)',
        'GET /api/booking/:bookingId': 'Get booking details',
        'GET /api/booking/:bookingId/payments': 'Get booking payments',
        'GET /api/booking/:bookingId/test-room-stays': 'Test room stays retrieval',
        'GET /api/booking/health': 'Booking service health check'
      },
      general: {
        'GET /': 'API status and information',
        'GET /api/health': 'Overall API health check',
        'GET /test': 'Simple test endpoint',
        'GET /api/docs': 'This documentation'
      }
    },
    paymentFlow: {
      description: 'NEW IMPROVED payment-enabled booking flow',
      version: '2.1.0',
      steps: [
        '1. Customer fills booking form with payment details',
        '2. Backend creates contact in ResHarmonics',
        '3. Backend creates booking in ENQUIRY status',
        '4. Backend retrieves room stays (separate endpoint if needed)',
        '5. Backend updates booking status to PENDING',
        '6. Backend retrieves and posts booking invoices',
        '7. Backend processes payment through ResHarmonics',
        '8. Backend updates booking status to CONFIRMED',
        '9. Customer receives confirmed booking'
      ],
      improvements: [
        'Proper status progression: ENQUIRY → PENDING → CONFIRMED',
        'Room stays fetched via separate endpoint if needed',
        'Invoice posting before payment processing',
        'Better error handling with rollback capabilities',
        'More detailed response data',
        'Test endpoints for debugging'
      ],
      statusFlow: {
        ENQUIRY: 'Initial booking creation',
        PENDING: 'Booking ready for payment processing',
        CONFIRMED: 'Payment successful, booking confirmed'
      },
      testEndpoints: {
        'GET /api/booking/:bookingId/test-room-stays': 'Test if room stays can be retrieved for debugging'
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/docs',
      'GET /test',
      'POST /api/availability/search',
      'POST /api/booking/create',
      'POST /api/booking/create-with-payment',
      'GET /api/booking/:bookingId',
      'GET /api/booking/:bookingId/payments',
      'GET /api/booking/:bookingId/test-room-stays'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = app;
