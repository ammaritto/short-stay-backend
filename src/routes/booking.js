const express = require('express');
const { body } = require('express-validator');
const { createBooking, getBooking } = require('../controllers/bookingController');

const router = express.Router();

router.post('/create', [
  body('guestDetails.firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('guestDetails.lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('guestDetails.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('guestDetails.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Valid phone number required'),
  body('stayDetails.startDate')
    .isISO8601()
    .withMessage('Valid start date required (YYYY-MM-DD)'),
  body('stayDetails.endDate')
    .isISO8601()
    .withMessage('Valid end date required (YYYY-MM-DD)'),
  body('stayDetails.inventoryTypeId')
    .isInt({ min: 1 })
    .withMessage('Valid unit type ID required'),
  body('stayDetails.rateId')
    .isInt({ min: 1 })
    .withMessage('Valid rate ID required')
], createBooking);

router.get('/:bookingId', [
  body('bookingId').isInt({ min: 1 }).withMessage('Valid booking ID required')
], getBooking);

module.exports = router;