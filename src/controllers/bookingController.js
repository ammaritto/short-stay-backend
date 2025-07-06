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

// Step 1: Create contact in RES:Harmonics
const contactData = {
  firstName: guestDetails.firstName,
  lastName: guestDetails.lastName,
  email: guestDetails.email, // Use 'email' key for consistency
  phone: guestDetails.phone || null
};

let contact;
try {
  contact = await resHarmonicsService.createContact(contactData);
  console.log('Contact created:', contact.id);
} catch (error) {
  console.error('Contact creation failed:', error.message);
  // Continue without contact creation if it fails
}

    // Step 2: Create booking with correct RES:Harmonics format
    const bookingData = {
      bookingContactId: contact?.id || null,
      billingContactId: contact?.id || null,
      bookingSource: "DIRECT", // Source of the booking
      bookingType: "STANDARD", // Type of booking
      currency: "GBP", // Default currency
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
      // Guest information for the primary guest
      primaryGuest: {
        firstName: guestDetails.firstName,
        lastName: guestDetails.lastName,
        emailAddress: guestDetails.email,
        phoneNumber: guestDetails.phone || null
      }
    };

    console.log('Creating booking with data:', JSON.stringify(bookingData, null, 2));

    // Create the booking
    const booking = await resHarmonicsService.createBooking(bookingData);

    console.log('Booking created:', booking.id);

    // Step 3: Update booking status to ENQUIRY (as requested)
    try {
      await resHarmonicsService.updateBookingStatus(booking.id, {
        statusUpdates: [{
          roomStayId: booking.roomStays?.[0]?.id,
          status: 'ENQUIRY' // Changed from CONFIRMED to ENQUIRY as requested
        }]
      });
      console.log('Booking status updated to ENQUIRY');
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
      // Continue even if status update fails
    }

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
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
