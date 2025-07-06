const express = require('express');
const { createBooking, getBooking } = require('../controllers/bookingController');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Booking routes working!', 
    timestamp: new Date().toISOString() 
  });
});

// Simple booking creation - no validation for now
router.post('/create', createBooking);

// Get booking by ID
router.get('/:bookingId', getBooking);

module.exports = router;
