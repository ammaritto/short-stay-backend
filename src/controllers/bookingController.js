// FINAL CORRECTED VERSION - Based on Official RES:Harmonics API Documentation
// src/controllers/bookingController.js

const resHarmonicsService = require('../services/resharmonicsService');

// Helper function to generate payment reference
const generatePaymentReference = () => {
  return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// Card type validation to match RES:Harmonics API
const validateCardType = (cardNumber) => {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  const firstFourDigits = cardNumber.substring(0, 4);

  // Based on RES:Harmonics API documentation
  if (firstDigit === '4') {
    if (['4026', '4508', '4844', '4913', '4917'].includes(firstFourDigits)) {
      return 'VISA_ELECTRON';
    }
    return 'VISA_CREDIT';
  }
  
  if (['51', '52', '53', '54', '55'].includes(firstTwoDigits)) {
    return 'MASTERCARD';
  }
  
  if (firstTwoDigits === '34' || firstTwoDigits === '37') {
    return 'AMERICAN_EXPRESS';
  }
  
  if (['30', '36', '38'].includes(firstTwoDigits)) {
    return 'DINERS_CLUB';
  }
  
  if (['50', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69'].includes(firstTwoDigits)) {
    return 'MAESTRO';
  }
  
  if (firstTwoDigits === '35') {
    return 'JCB';
  }
  
  return 'VISA_CREDIT';
};

// MAIN FUNCTION: Create booking with payment (CORRECTED to match official API)
const createBookingWithPayment = async (req, res) => {
  let contact = null;
  let booking = null;

  try {
    const { guestDetails, stayDetails, unitDetails, paymentDetails } = req.body;

    console.log('Creating booking with payment:', {
      guestDetails,
      stayDetails,
      unitDetails,
      paymentAmount: paymentDetails?.amount
    });

    // Validate required payment details
    if (!paymentDetails || !paymentDetails.amount || !paymentDetails.cardNumber) {
      return res.status(400).json({
        success: false,
        error: 'Payment details are required',
        message: 'Card number and amount must be provided'
      });
    }

    // Step 1: Create or find contact
    try {
      contact = await resHarmonicsService.createContact(guestDetails);
      console.log('Contact created/found:', contact.id);
    } catch (contactError) {
      console.error('Contact creation failed:', contactError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to create guest contact',
        message: contactError.message
      });
    }

    // Step 2: Create booking using CORRECT API structure
    const bookingPayload = {
      // Required fields according to API documentation
      bookingContactId: contact.id,
      billingContactId: contact.id,
      bookingFinanceAccountId: contact.id, // Assuming contact ID can be used
      billingFinanceAccountId: contact.id,
      billingFrequencyId: 1, // You may need to get this from your system
      bookingTypeId: 1, // You may need to get this from your system
      channelId: 1, // You may need to get this from your system
      
      // Optional fields
      notes: `Web booking with payment for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
      // Room stays array with CORRECT structure
      roomStays: [{
        startDate: stayDetails.startDate,
        endDate: stayDetails.endDate,
        numberOfAdults: parseInt(stayDetails.guests),
        numberOfChildren: 0,
        numberOfInfants: 0,
        rateId: unitDetails.rateId,
        // CORRECT: Use string enum and separate ID field
        inventoryType: 'UNIT_TYPE',
        inventoryTypeId: unitDetails.inventoryTypeId
      }]
    };

    console.log('Creating booking with payload:', JSON.stringify(bookingPayload, null, 2));

    try {
      booking = await resHarmonicsService.createBooking(bookingPayload);
      console.log('Booking created successfully:', booking.id);
    } catch (bookingError) {
      console.error('Booking creation failed:', bookingError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to create booking',
        message: bookingError.message
      });
    }

    // Step 3: Process payment using CORRECT payment structure
    const cardType = validateCardType(paymentDetails.cardNumber);
    const lastFour = paymentDetails.cardNumber.replace(/\s/g, '').slice(-4);
    const paymentReference = generatePaymentReference();

    // CORRECT payment structure according to API documentation
    const paymentData = {
      paymentReference: paymentReference,
      paymentType: 'CARD_PAYMENT', // CORRECT: API expects 'paymentType'
      amount: parseFloat(paymentDetails.amount),
      lastFour: lastFour,
      cardType: cardType
    };

    console.log('Processing payment:', paymentData);

    try {
      const paymentResult = await resHarmonicsService.createBookingPayment(booking.id, paymentData);
      console.log('Payment processed successfully:', paymentResult);
    } catch (paymentError) {
      console.error('Payment processing failed:', paymentError.message);
      return res.status(400).json({
        success: false,
        error: 'Payment processing failed',
        message: paymentError.message,
        bookingId: booking.id
      });
    }

    // Step 4: Update booking status to CONFIRMED
    try {
      if (booking.roomStays && booking.roomStays.length > 0) {
        const roomStayId = booking.roomStays[0].id;
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'CONFIRMED'
          }]
        });
        console.log('Booking status updated to CONFIRMED');
      }
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
      console.log('Payment was successful, but status update failed. Booking may need manual confirmation.');
    }

    // Step 5: Return success response
    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        status: 'confirmed',
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        checkIn: stayDetails.startDate,
        checkOut: stayDetails.endDate,
        contactId: contact.id,
        paymentReference: paymentReference,
        paymentAmount: paymentDetails.amount
      }
    });

  } catch (error) {
    console.error('Create booking with payment error:', {
      message: error.message,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking with payment',
      message: error.message,
      debug: {
        contactCreated: !!contact,
        contactId: contact?.id,
        bookingCreated: !!booking,
        bookingId: booking?.id
      }
    });
  }
};

// Legacy booking creation (CORRECTED to match official API)
const createBooking = async (req, res) => {
  let contact = null;

  try {
    const { guestDetails, stayDetails, unitDetails } = req.body;

    console.log('Creating booking (legacy):', {
      guestDetails,
      stayDetails,
      unitDetails
    });

    // Step 1: Create contact
    try {
      contact = await resHarmonicsService.createContact(guestDetails);
      console.log('Contact created:', contact.id);
    } catch (contactError) {
      console.error('Contact creation failed:', contactError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to create guest contact',
        message: contactError.message
      });
    }

    // Step 2: Create booking using CORRECT API structure
    const bookingPayload = {
      // Required fields
      bookingContactId: contact.id,
      billingContactId: contact.id,
      bookingFinanceAccountId: contact.id,
      billingFinanceAccountId: contact.id,
      billingFrequencyId: 1,
      bookingTypeId: 1,
      channelId: 1,
      
      notes: `Web booking for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
      roomStays: [{
        startDate: stayDetails.startDate,
        endDate: stayDetails.endDate,
        numberOfAdults: parseInt(stayDetails.guests),
        numberOfChildren: 0,
        numberOfInfants: 0,
        rateId: unitDetails.rateId,
        inventoryType: 'UNIT_TYPE',
        inventoryTypeId: unitDetails.inventoryTypeId
      }]
    };

    console.log('Creating booking with payload:', JSON.stringify(bookingPayload, null, 2));

    const booking = await resHarmonicsService.createBooking(bookingPayload);
    console.log('Booking created successfully:', booking);

    // Step 3: Update status to CONFIRMED (or keep as ENQUIRY)
    try {
      if (booking.roomStays && booking.roomStays.length > 0) {
        const roomStayId = booking.roomStays[0].id;
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'ENQUIRY' // Keep as enquiry for legacy bookings
          }]
        });
        console.log('Booking status updated to ENQUIRY');
      }
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
    }

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
        bookingCreated: false,
        bookingId: null
      }
    });
  }
};

// Get booking details
const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log(`Fetching booking details for ID: ${bookingId}`);

    const booking = await resHarmonicsService.getBooking(bookingId);
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to fetch booking',
      message: error.message
    });
  }
};

// Get booking payments
const getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log(`Fetching payments for booking ID: ${bookingId}`);

    const payments = await resHarmonicsService.getBookingPayments(bookingId);
    
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get booking payments error:', error.message);
    res.status(400).json({
      success: false,
      error: 'Failed to fetch booking payments',
      message: error.message
    });
  }
};

module.exports = {
  createBooking,
  createBookingWithPayment,
  getBooking,
  getBookingPayments
};
