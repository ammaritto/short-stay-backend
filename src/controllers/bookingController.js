const { validationResult } = require('express-validator');
const resHarmonicsService = require('../services/resharmonicsService');

const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { guestDetails, stayDetails } = req.body;

    console.log('Creating booking for:', guestDetails.email);
    console.log('Stay details:', JSON.stringify(stayDetails, null, 2));

    // For now, let's just return a mock success response to test the flow
    // Once we confirm this works, we'll add the actual API call
    
    const mockBookingResponse = {
      id: Math.floor(Math.random() * 10000),
      bookingReference: `BK${Math.floor(Math.random() * 100000)}`,
      status: 'ENQUIRY'
    };

    console.log('Mock booking created:', mockBookingResponse);

    res.json({
      success: true,
      data: {
        bookingId: mockBookingResponse.id,
        bookingReference: mockBookingResponse.bookingReference,
        status: 'enquiry',
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        checkIn: stayDetails.startDate,
        checkOut: stayDetails.endDate
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking',
      message: error.message 
    });
  }
};

const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('Fetching booking:', bookingId);
    
    // Mock response for now
    res.json({
      success: true,
      data: {
        id: bookingId,
        status: 'ENQUIRY',
        message: 'This is a mock booking response'
      }
    });

  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch booking',
      message: error.message 
    });
  }
};

module.exports = {
  createBooking,
  getBooking
};
