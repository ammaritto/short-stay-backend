const express = require('express');
const { query } = require('express-validator');
const { searchAvailability, getBuildings } = require('../controllers/availabilityController');

const router = express.Router();

router.get('/search', [
  query('startDate').isISO8601().withMessage('Valid start date required (YYYY-MM-DD)'),
  query('endDate').isISO8601().withMessage('Valid end date required (YYYY-MM-DD)'),
  query('guests').optional().isInt({ min: 1, max: 10 }).withMessage('Guests must be between 1 and 10')
], searchAvailability);

router.get('/buildings', getBuildings);

module.exports = router;