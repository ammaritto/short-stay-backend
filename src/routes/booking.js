const express = require('express');
const router = express.Router();
const { 
  createBooking, 
  createBookingWithPayment, 
  getBooking, 
  getBookingPayments 
} = require('../controllers/bookingController');

// Import the service for the test endpoint
const resHarmonicsService = require('../services/resharmonicsService');

// Health check for booking routes (put this FIRST)
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'Booking routes are working',
    routes: [
      'POST /create - Legacy booking creation',
      'POST /create-with-payment - New booking with payment',
      'GET /:bookingId - Get booking details (numeric ID only)',
      'GET /:bookingId/payments - Get booking payments',
      'GET /:bookingId/test-room-stays - Test room stays retrieval',
      'GET /:bookingId/debug-accounts - Debug account relationships'
    ]
  });
});

// Diagnostic endpoint to check booking account relationships
router.get('/:bookingId/debug-accounts', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Validate bookingId is numeric
    if (!/^\d+$/.test(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID must be a number'
      });
    }
    
    console.log(`Debugging account relationships for booking ${bookingId}`);
    
    const booking = await resHarmonicsService.getBooking(bookingId);
    
    const accountAnalysis = {
      bookingId: bookingId,
      bookingReference: booking.bookingReference,
      contacts: {
        bookingContact: {
          id: booking.bookingContact?.id,
          name: `${booking.bookingContact?.firstName} ${booking.bookingContact?.lastName}`,
          email: booking.bookingContact?.emailAddress
        },
        billingContact: {
          id: booking.billingContact?.id,
          name: `${booking.billingContact?.firstName} ${booking.billingContact?.lastName}`,
          email: booking.billingContact?.emailAddress
        }
      },
      accounts: {
        bookingAccount: {
          id: booking.bookingAccount?.id,
          accountCode: booking.bookingAccount?.accountCode,
          contactId: booking.bookingAccount?.contact?.id,
          contactName: `${booking.bookingAccount?.contact?.firstName} ${booking.bookingAccount?.contact?.lastName}`,
          contactEmail: booking.bookingAccount?.contact?.emailAddress
        },
        billingAccount: {
          id: booking.billingAccount?.id,
          accountCode: booking.billingAccount?.accountCode,
          contactId: booking.billingAccount?.contact?.id,
          contactName: `${booking.billingAccount?.contact?.firstName} ${booking.billingAccount?.contact?.lastName}`,
          contactEmail: booking.billingAccount?.contact?.emailAddress
        }
      },
      analysis: {
        contactsMatch: booking.bookingContact?.id === booking.billingContact?.id,
        bookingAccountMatchesContact: booking.bookingAccount?.contact?.id === booking.bookingContact?.id,
        billingAccountMatchesContact: booking.billingAccount?.contact?.id === booking.bookingContact?.id,
        accountsMatch: booking.bookingAccount?.id === booking.billingAccount?.id
      },
      recommendations: []
    };
    
    // Add recommendations
    if (!accountAnalysis.analysis.contactsMatch) {
      accountAnalysis.recommendations.push('Booking and billing contacts are different - this may be intentional');
    }
    if (!accountAnalysis.analysis.bookingAccountMatchesContact) {
      accountAnalysis.recommendations.push('Booking account is linked to a different contact than the booking contact');
    }
    if (!accountAnalysis.analysis.billingAccountMatchesContact) {
      accountAnalysis.recommendations.push('Billing account is linked to a different contact than the booking contact');
    }
    if (accountAnalysis.analysis.contactsMatch && accountAnalysis.analysis.bookingAccountMatchesContact && accountAnalysis.analysis.billingAccountMatchesContact) {
      accountAnalysis.recommendations.push('All accounts and contacts are properly aligned');
    }
    
    res.json({
      success: true,
      message: 'Account relationships analyzed',
      analysis: accountAnalysis
    });
    
  } catch (error) {
    console.error('Debug accounts error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Debug failed',
      message: error.message
    });
  }
});

// Test endpoint to check room stays for a booking
router.get('/:bookingId/test-room-stays', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Validate bookingId is numeric
    if (!/^\d+$/.test(bookingId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID',
        message: 'Booking ID must be a number'
      });
    }
    
    console.log(`Testing room stays retrieval for booking ${bookingId}`);
    
    // Test both methods
    const results = {
      bookingId: bookingId,
      methods: {}
    };
    
    // Method 1: Get full booking (should now include room stays)
    try {
      const fullBooking = await resHarmonicsService.getBooking(bookingId);
      results.methods.fullBooking = {
        success: true,
        roomStaysFound: !!(fullBooking.roomStays && fullBooking.roomStays.length > 0),
        roomStayCount: fullBooking.roomStays ? fullBooking.roomStays.length : 0,
        roomStays: fullBooking.roomStays || [],
        bookingReference: fullBooking.bookingReference
      };
    } catch (error) {
      results.methods.fullBooking = {
        success: false,
        error: error.message
      };
    }
    
    // Method 2: Get room stays directly  
    try {
      const roomStays = await resHarmonicsService.getBookingRoomStays(bookingId);
      results.methods.directRoomStays = {
        success: true,
        roomStayCount: roomStays.length,
        roomStays: roomStays
      };
    } catch (error) {
      results.methods.directRoomStays = {
        success: false,
        error: error.message
      };
    }
    
    // Determine recommendation
    let recommendation = '';
    if (results.methods.directRoomStays.success && results.methods.directRoomStays.roomStayCount > 0) {
      recommendation = 'Room stays found via direct endpoint. The updated controller should work.';
    } else if (results.methods.fullBooking.success && results.methods.fullBooking.roomStaysFound) {
      recommendation = 'Room stays found in full booking. The controller should work.';
    } else {
      recommendation = 'No room stays found. Check if the booking creation parameters (rateId, inventoryTypeId, dates) are valid.';
    }
    
    res.json({
      success: true,
      message: 'Room stays test completed',
      recommendation: recommendation,
      results: results
    });
    
  } catch (error) {
    console.error('Test room stays error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Test failed',
      message: error.message
    });
  }
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
