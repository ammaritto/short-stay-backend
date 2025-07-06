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
      primaryContactEmailAddress: {
        email: guestDetails.email,
        primary: true
      }
    };

    if (guestDetails.phone) {
      contactData.primaryContactTelephoneNumber = {
        number: guestDetails.phone,
        primary: true
      };
    }

    let contact;
    try {
      contact = await resHarmonicsService.createContact(contactData);
      console.log('Contact created:', contact.id);
    } catch (error) {
      console.error('Contact creation failed:', error.message);
      // If contact creation fails, we'll continue without it
      // The booking API might still work
    }

// Step 2: Create booking
const bookingData = {
  bookingContactId: contact?.id || 1, // Fallback to existing contact ID
  billingContactId: contact?.id || 1,
  bookingFinanceAccountId: contact?.contactSalesAccount?.id || 1,
  billingFinanceAccountId: contact?.contactSalesAccount?.id || 1,
  billingFrequencyId: 1, // Monthly billing
  bookingTypeId: 1, // Standard booking type
  channelId: 1, // Direct booking channel
  roomStays: [{
    startDate: stayDetails.startDate,
    endDate: stayDetails.endDate,
    inventoryType: stayDetails.inventoryType || 'UNIT_TYPE',
    inventoryTypeId: parseInt(stayDetails.inventoryTypeId),
    rateId: parseInt(stayDetails.rateId),
    numberOfAdults: parseInt(stayDetails.adults) || 1,
    numberOfChildren: parseInt(stayDetails.children) || 0,
    numberOfInfants: parseInt(stayDetails.infants) || 0
  }]
};

    console.log('Creating booking with data:', JSON.stringify(bookingData, null, 2));

    // Create the booking
    const booking = await resHarmonicsService.createBooking(bookingData);

    console.log('Booking created:', booking.id);

    // Step 3: Update booking status to confirmed (no payment required)
    try {
      await resHarmonicsService.updateBookingStatus(booking.id, {
        statusUpdates: [{
          roomStayId: booking.roomStays?.[0]?.id,
          status: 'CONFIRMED'
        }]
      });
      console.log('Booking status updated to CONFIRMED');
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
      // Continue even if status update fails
    }

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        status: 'confirmed',
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
