const express = require('express');
const router = express.Router();
const { 
  createBooking, 
  createBookingWithPayment, 
  getBooking, 
  getBookingPayments 
} = require('../controllers/bookingController');

// Health check for booking routes (put this FIRST)
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Booking routes are working',
    routes: [
      'POST /create - Legacy booking creation',
      'POST /create-with-payment - New booking with payment',
      'GET /:bookingId - Get booking details (numeric ID only)',
      'GET /:bookingId/payments - Get booking payments'
    ]
  });
});

// Legacy booking creation (without payment)
router.post('/create', createBooking);

// New booking creation with payment
router.post('/create-with-payment', createBookingWithPayment);

// Get booking payments (put this BEFORE the generic /:bookingId route)
router.get('/:bookingId/payments', (req, res, next) => {
  // Ensure bookingId is numeric
  if (!/^\d+$/.test(req.params.bookingId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid booking ID',
      message: 'Booking ID must be a number'
    });
  }
  next();
}, getBookingPayments);

// Get booking details (put this LAST and add validation)
router.get('/:bookingId', (req, res, next) => {
  // Ensure bookingId is numeric
  if (!/^\d+$/.test(req.params.bookingId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid booking ID',
      message: 'Booking ID must be a number. If you are looking for API endpoints, try /api/booking/health'
    });
  }
  next();
}, getBooking);

module.exports = router;
