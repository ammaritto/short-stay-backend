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

    // Skip contact creation for now and focus on booking
    // We'll use a minimal booking payload that matches RES:Harmonics API

    // Simplified booking data structure based on RES:Harmonics API documentation
    const bookingData = {
      roomStays: [{
        arrivalDate: stayDetails.startDate,
        departureDate: stayDetails.endDate,
        inventoryTypeId: parseInt(stayDetails.inventoryTypeId),
        rateId: parseInt(stayDetails.rateId),
        guestCounts: {
          adults: parseInt(stayDetails.adults) || 1,
          children: parseInt(stayDetails.children) || 0,
          infants: parseInt(stayDetails.infants) || 0
        }
      }],
      guest: {
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        emailAddress: guestDetails.email,
        telephoneNumber: guestDetails.phone || null
      },
      source: "ONLINE",
      status: "ENQUIRY"
    };

    console.log('Creating booking with simplified data:', JSON.stringify(bookingData, null, 2));

    // Create the booking
    const booking = await resHarmonicsService.createBooking(bookingData);

    console.log('Booking created successfully:', booking.id);

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference || booking.id,
        status: 'enquiry',
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        checkIn: stayDetails.startDate,
        checkOut: stayDetails.endDate
      }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    
    // Extract more specific error information
    let errorMessage = 'Failed to create booking';
    if (error.message && error.message.includes('RES:Harmonics API error')) {
      errorMessage = error.message;
    }
    
    res.status(500).json({ 
      success: false, 
      error: errorMessage,
      message: error.message 
    });
  }
};

const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('Fetching booking:', bookingId);
    
    const booking = await resHarmonicsService.getBooking(bookingId);

    res.json({
      success: true,
      data: booking
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
