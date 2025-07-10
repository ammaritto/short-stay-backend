const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const availabilityRoutes = require('./src/routes/availability');
const bookingRoutes = require('./src/routes/booking');
const paymentRoutes = require('./src/routes/payment');

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for payment data
app.use(express.urlencoded({ extended: true }));

// Add availability routes
app.use('/api/availability', availabilityRoutes);

// Add booking routes
app.use('/api/booking', bookingRoutes);

// Add payment routes (Stripe only)
app.use('/api/payment', paymentRoutes);

// Test routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Short Stay Booking API is working!',
    timestamp: new Date().toISOString(),
    version: '3.0.0', // Major version update for Stripe-only payments
    features: [
      'Property availability search',
      'Booking creation (inquiry only)',
      'Booking creation with Stripe payment',
      'Stripe payment processing (REQUIRED for bookings)',
      'Invoice posting',
      'Room stays management'
    ],
    paymentInfo: 'All payments are processed exclusively through Stripe'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    environment: process.env.NODE_ENV,
    hasCredentials: {
      resHarmonics: {
        clientId: !!process.env.RH_CLIENT_ID,
        clientSecret: !!process.env.RH_CLIENT_SECRET,
        authUrl: !!process.env.RH_AUTH_URL,
        baseUrl: !!process.env.RH_BASE_URL,
        scope: process.env.RH_SCOPE || 'api/read api/write'
      },
      stripe: {
        publishableKey: !!process.env.STRIPE_PUBLISHABLE_KEY,
        secretKey: !!process.env.STRIPE_SECRET_KEY
      }
    },
    features: {
      availability: true,
      booking: true,
      stripePaymentRequired: true,
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
    version: '3.0.0',
    importantNote: 'All payments MUST be processed through Stripe. ResHarmonics is used only for booking management.',
    endpoints: {
      availability: {
        'POST /api/availability/search': 'Search for available properties'
      },
      booking: {
        'POST /api/booking/create': 'Create booking inquiry (NO PAYMENT - enquiry only)',
        'POST /api/booking/create-with-payment': 'Create confirmed booking (REQUIRES Stripe payment)',
        'GET /api/booking/:bookingId': 'Get booking details',
        'GET /api/booking/:bookingId/payments': 'Get booking payment records'
      },
      payment: {
        'POST /api/payment/create-intent': 'Create Stripe payment intent (Step 1)',
        'POST /api/payment/verify': 'Verify Stripe payment status (Optional)'
      }
    },
    bookingFlow: {
      description: 'Stripe-First Payment Flow',
      steps: [
        '1. Search for availability using /api/availability/search',
        '2. Create Stripe payment intent using /api/payment/create-intent',
        '3. Customer completes payment using Stripe Elements in frontend',
        '4. Frontend receives successful payment confirmation from Stripe',
        '5. Frontend calls /api/booking/create-with-payment with stripePaymentIntentId',
        '6. Backend verifies payment with Stripe',
        '7. Backend creates booking in ResHarmonics',
        '8. Backend records payment reference in ResHarmonics',
        '9. Booking is confirmed and customer receives confirmation'
      ],
      criticalNotes: [
        'Payment MUST be completed in Stripe before booking creation',
        'stripePaymentIntentId is REQUIRED for confirmed bookings',
        'ResHarmonics only stores payment records, not process payments',
        'All refunds must be handled through Stripe Dashboard or API'
      ]
    },
    paymentSecurity: {
      pciCompliance: 'Maintained through Stripe Elements',
      cardData: 'Never touches our servers - handled entirely by Stripe',
      paymentReference: 'Stripe Payment Intent ID is used as reference in ResHarmonics'
    },
    errorHandling: {
      paymentSuccess_bookingFail: 'Customer is notified to contact support with Stripe payment reference',
      doublePaymentPrevention: 'Stripe Payment Intents prevent duplicate charges',
      refunds: 'Must be processed through Stripe Dashboard or Refund API'
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
      'POST /api/payment/create-intent',
      'POST /api/payment/verify'
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