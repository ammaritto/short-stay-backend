const express = require('express');
const router = express.Router();
const { 
  createBooking, 
  createBookingWithPayment, 
  getBooking, 
  getBookingPayments 
} = require('../controllers/bookingController');

// Legacy booking creation (without payment)
router.post('/create', createBooking);

// New booking creation with payment
router.post('/create-with-payment', createBookingWithPayment);

// Get booking details
router.get('/:bookingId', getBooking);

// Get booking payments
router.get('/:bookingId/payments', getBookingPayments);

// Health check for booking routes
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Booking routes are working',
    routes: [
      'POST /create - Legacy booking creation',
      'POST /create-with-payment - New booking with payment',
      'GET /:bookingId - Get booking details',
      'GET /:bookingId/payments - Get booking payments'
    ]
  });
});

module.exports = router;
