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

    // Step 1: Create contact (this works perfectly)
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
      
      // Verify contact has email and phone
      if (!contact.contactEmailAddresses || contact.contactEmailAddresses.length === 0) {
        console.warn('WARNING: Contact created but email addresses missing');
      }
      if (!contact.contactTelephoneNumbers || contact.contactTelephoneNumbers.length === 0) {
        console.warn('WARNING: Contact created but telephone numbers missing');
      }
      
    } catch (contactError) {
      console.error('Contact creation failed:', contactError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to create contact',
        message: contactError.message
      });
    }

    // Step 2: Create booking with EXACT RES:Harmonics API structure
    const bookingPayload = {
      // Required contact IDs
      bookingContactId: contact.id,
      billingContactId: contact.id,
      
      // Required finance account IDs (using contact's account or defaults)
      bookingFinanceAccountId: contact.contactSalesAccount?.id || 1,
      billingFinanceAccountId: contact.contactSalesAccount?.id || 1,
      
      // Required IDs with defaults
      billingFrequencyId: 1, // Default billing frequency
      bookingTypeId: 1, // Default booking type
      channelId: 1, // Default channel (direct booking)
      
      // Optional fields
      customerReference: `WEB-${Date.now()}`,
      notes: `Booking created via web portal for ${guestDetails.firstName} ${guestDetails.lastName}`,
      reserveForMinutes: 60, // Hold availability for 1 hour
      
      // Room stays array - EXACTLY as per API documentation
      roomStays: [{
        // Required dates
        startDate: stayDetails.startDate,
        endDate: stayDetails.endDate,
        
        // Required inventory information
        inventoryType: "UNIT_TYPE", // Using unit type booking
        inventoryTypeId: parseInt(stayDetails.inventoryTypeId),
        
        // Required rate
        rateId: parseInt(stayDetails.rateId),
        
        // Required guest counts
        numberOfAdults: parseInt(stayDetails.adults) || 1,
        numberOfChildren: parseInt(stayDetails.children) || 0,
        numberOfInfants: parseInt(stayDetails.infants) || 0,
        
        // Optional guest assignment
        guestIds: [contact.id],
        
        // Optional notes
        externalNotes: `Web booking for ${guestDetails.firstName} ${guestDetails.lastName}`
      }]
    };

    console.log('Correct booking payload:', JSON.stringify(bookingPayload, null, 2));

    // Create the booking
    const booking = await resHarmonicsService.createBooking(bookingPayload);

    console.log('Booking created successfully:', booking);

    // Step 3: Update status to ENQUIRY (as requested)
    try {
      if (booking.roomStays && booking.roomStays.length > 0) {
        const roomStayId = booking.roomStays[0].id;
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'ENQUIRY'
          }]
        });
        console.log('Booking status updated to ENQUIRY');
      }
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
      // Continue even if status update fails - booking was created successfully
    }

    // Return success response
    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        status: 'enquiry',
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        checkIn: stayDetails.startDate,
        checkOut: stayDetails.endDate,
        contactId: contact.id
      }
    });

  } catch (error) {
    console.error('Create booking error details:', {
      message: error.message,
      requestBody: req.body
    });
    
    res.status(400).json({ 
      success: false, 
      error: 'Failed to create booking',
      message: error.message,
      debug: {
        contactCreated: !!contact,
        contactId: contact?.id,
        errorDetails: error.message
      }
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
