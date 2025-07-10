const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');

// Create payment intent
router.post('/create-intent', async (req, res) => {
  try {
    const { amount, currency, bookingDetails } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const result = await stripeService.createPaymentIntent(
      amount,
      currency || 'SEK',
      {
        guestName: bookingDetails?.guestName,
        checkIn: bookingDetails?.checkIn,
        checkOut: bookingDetails?.checkOut,
        propertyId: bookingDetails?.propertyId
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    
    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID required'
      });
    }

    const result = await stripeService.verifyPayment(paymentIntentId);
    res.json(result);
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
});

module.exports = router;