const express = require('express');
const { query, validationResult } = require('express-validator');
const { searchAvailability, getBuildings } = require('../controllers/availabilityController');

const router = express.Router();

// Custom validation functions
const validateMinimumStayLength = (value, { req }) => {
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(value);
  const diffTime = Math.abs(endDate - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 3) {
    throw new Error('Minimum stay is 3 nights');
  }
  return true;
};

const validateMinimumAdvanceBooking = (value) => {
  const startDate = new Date(value);
  const today = new Date();
  const minBookingDate = new Date(today);
  minBookingDate.setDate(today.getDate() + 3);
  
  // Reset time to start of day for accurate comparison
  startDate.setHours(0, 0, 0, 0);
  minBookingDate.setHours(0, 0, 0, 0);
  
  if (startDate < minBookingDate) {
    throw new Error('Bookings must be made at least 3 days in advance');
  }
  return true;
};

router.get('/search', [
  query('startDate')
    .isISO8601()
    .withMessage('Valid start date required (YYYY-MM-DD)')
    .custom(validateMinimumAdvanceBooking),
  query('endDate')
    .isISO8601()
    .withMessage('Valid end date required (YYYY-MM-DD)')
    .custom(validateMinimumStayLength),
  query('guests')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Guests must be between 1 and 10')
], (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
      message: 'Search validation failed'
    });
  }
  
  // If validation passes, proceed to the controller
  searchAvailability(req, res, next);
});

router.get('/buildings', getBuildings);

module.exports = router;
