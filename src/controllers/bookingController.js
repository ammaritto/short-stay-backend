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

    // Step 1: Create contact first (this should work as per your existing code)
    let contact = null;
    try {
      const contactData = {
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        email: guestDetails.email,
        phone: guestDetails.phone || null
      };

      console.log('Creating contact...');
      contact = await resHarmonicsService.createContact(contactData);
      console.log('Contact created:', contact.id);
    } catch (contactError) {
      console.error('Contact creation failed:', contactError.message);
      // Continue without contact for now
    }

    // Step 2: Create booking with proper RES:Harmonics format
    // Based on the API documentation structure
    const bookingPayload = {
      // Guest/Contact information
      bookingContactId: contact?.id || null,
      billingContactId: contact?.id || null,
      
      // Room stays array - this is the key part
      roomStays: [{
        // Date information
        arrivalDate: stayDetails.startDate,
        departureDate: stayDetails.endDate,
        
        // Inventory and rate
        inventoryTypeId: parseInt(stayDetails.inventoryTypeId),
        rateId: parseInt(stayDetails.rateId),
        
        // Guest counts
        guestCounts: {
          adults: parseInt(stayDetails.adults) || 1,
          children: parseInt(stayDetails.children) || 0,
          infants: parseInt(stayDetails.infants) || 0
        },
        
        // Required booking fields
        numberOfAdults: parseInt(stayDetails.adults) || 1,
        numberOfChildren: parseInt(stayDetails.children) || 0,
        numberOfInfants: parseInt(stayDetails.infants) || 0
      }],
      
      // Booking metadata
      bookingSource: "DIRECT",
      bookingType: "STANDARD",
      
      // Guest details (alternative format in case contact creation failed)
      primaryGuest: {
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        emailAddress: guestDetails.email,
        phoneNumber: guestDetails.phone || null
      },
      
      // Currency and status
      currency: "GBP",
      status: "ENQUIRY"
    };

    console.log('Creating booking with payload:', JSON.stringify(bookingPayload, null, 2));

    // Create the booking
    const booking = await resHarmonicsService.createBooking(bookingPayload);

    console.log('Booking created successfully:', {
      id: booking.id,
      reference: booking.bookingReference,
      status: booking.status
    });

    // Return success response
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
    
    // Extract specific API error information
    let errorMessage = 'Failed to create booking';
    let statusCode = 500;
    
    if (error.message) {
      if (error.message.includes('400')) {
        statusCode = 400;
        errorMessage = 'Invalid booking data format';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        statusCode = 401;
        errorMessage = 'Authentication failed';
      } else if (error.message.includes('RES:Harmonics API error')) {
        errorMessage = error.message;
      }
    }
    
    res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      message: error.message,
      // Include the payload for debugging (remove in production)
      debugPayload: req.body
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
