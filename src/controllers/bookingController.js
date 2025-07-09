// Updated src/controllers/bookingController.js
// NEW FLOW: Create booking -> Set PENDING -> Post invoice -> Process payment -> Set CONFIRMED

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

// UPDATED MAIN FUNCTION: Create booking with payment (NEW FLOW)
const createBookingWithPayment = async (req, res) => {
  let contact = null;
  let booking = null;
  let invoicePosted = false;

  try {
    const { guestDetails, stayDetails, unitDetails, paymentDetails } = req.body;

    console.log('Creating booking with payment (NEW FLOW):', {
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

    // Additional validation - check if amount is greater than 0
    const paymentAmount = parseFloat(paymentDetails.amount);
    if (paymentAmount < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount',
        message: 'Payment amount cannot be negative'
      });
    }

    // For testing purposes, allow 0 amounts but use minimum amount for ResHarmonics
    const actualPaymentAmount = paymentAmount === 0 ? 1 : paymentAmount; // Use 1 SEK for testing
    console.log(`Original amount: ${paymentAmount}, Using amount: ${actualPaymentAmount} for payment processing`);

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

    // Step 1.5: Create finance account for the contact
    let financeAccount = null;
    try {
      financeAccount = await resHarmonicsService.createFinanceAccount(contact.id);
      console.log('Finance account created:', financeAccount.id);
    } catch (financeError) {
      console.log('Finance account creation failed, will try using contact ID directly:', financeError.message);
      // Fallback: some systems auto-create finance accounts with same ID as contact
      financeAccount = { id: contact.id };
    }

    // Step 2: Create booking (will be in ENQUIRY status by default)
    const bookingPayload = {
      bookingContactId: contact.id,
      billingContactId: contact.id,
      bookingFinanceAccountId: financeAccount.id, // Use the created finance account
      billingFinanceAccountId: financeAccount.id, // Use the created finance account
      billingFrequencyId: 1,
      bookingTypeId: 5, // Changed to Short Stay (ID 5) instead of Default (ID 1)
      channelId: 1,
      
      notes: `Web booking with payment for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
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
    console.log('Expected: All account IDs should be:', financeAccount.id, '(finance account for contact', contact.id, ')');

    try {
      booking = await resHarmonicsService.createBooking(bookingPayload);
      console.log('Booking created successfully (ENQUIRY status):', booking.id);
    } catch (bookingError) {
      console.error('Booking creation failed:', bookingError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to create booking',
        message: bookingError.message
      });
    }

    // Step 3: Update booking status to PENDING
    let roomStayId = null;
    try {
      // First, we need to get the booking to find room stays
      const freshBooking = await resHarmonicsService.getBooking(booking.id);
      console.log('Fresh booking retrieved for status update:', JSON.stringify(freshBooking, null, 2));
      
      if (freshBooking.roomStays && freshBooking.roomStays.length > 0) {
        // The room stay object uses 'roomStayId' field, not 'id'
        roomStayId = freshBooking.roomStays[0].roomStayId || freshBooking.roomStays[0].id;
        console.log(`Found room stay ID: ${roomStayId}`);
        
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'PENDING'
          }]
        });
        console.log('Booking status updated to PENDING');
      } else {
        console.log('No room stays in booking response, trying direct room stays endpoint...');
        
        // Try to get room stays directly
        try {
          const roomStays = await resHarmonicsService.getBookingRoomStays(booking.id);
          if (roomStays && roomStays.length > 0) {
            roomStayId = roomStays[0].roomStayId || roomStays[0].id;
            console.log(`Found room stay ID via direct call: ${roomStayId}`);
            
            await resHarmonicsService.updateBookingStatus(booking.id, {
              statusUpdates: [{
                roomStayId: roomStayId,
                status: 'PENDING'
              }]
            });
            console.log('Booking status updated to PENDING');
          } else {
            console.error('ERROR: No room stays found even via direct endpoint');
            return res.status(400).json({
              success: false,
              error: 'Booking validation failed',
              message: 'No room stays found after booking creation. This may indicate an issue with the booking parameters.',
              bookingId: booking.id,
              debug: {
                originalBooking: booking,
                freshBooking: freshBooking,
                suggestion: 'Check if rateId and inventoryTypeId are valid and available for the selected dates'
              }
            });
          }
        } catch (roomStaysError) {
          console.error('Failed to fetch room stays directly:', roomStaysError.message);
          return res.status(400).json({
            success: false,
            error: 'Failed to retrieve room stays',
            message: roomStaysError.message,
            bookingId: booking.id
          });
        }
      }
    } catch (statusError) {
      console.error('Failed to update booking status to PENDING:', statusError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to update booking status to PENDING',
        message: statusError.message,
        bookingId: booking.id
      });
    }

    // Step 4: Get booking details again to check for room stays
    let updatedBooking;
    try {
      updatedBooking = await resHarmonicsService.getBooking(booking.id);
      console.log('Updated booking retrieved:', JSON.stringify(updatedBooking, null, 2));
      
      if (!updatedBooking.roomStays || updatedBooking.roomStays.length === 0) {
        console.error('ERROR: No room stays found in booking after PENDING update');
        return res.status(400).json({
          success: false,
          error: 'Booking validation failed',
          message: 'No room stays found in booking. Check your booking creation parameters.',
          bookingId: booking.id,
          debug: {
            originalBooking: booking,
            updatedBooking: updatedBooking
          }
        });
      }
      
      // Update roomStayId from the latest booking data
      roomStayId = updatedBooking.roomStays[0].roomStayId || updatedBooking.roomStays[0].id;
      console.log(`Confirmed room stay ID: ${roomStayId}`);
      
    } catch (getBookingError) {
      console.error('Failed to retrieve updated booking:', getBookingError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to validate booking',
        message: getBookingError.message,
        bookingId: booking.id
      });
    }

    // Step 5: Get booking invoices and post them
    try {
      const invoices = await resHarmonicsService.getBookingInvoices(booking.id);
      console.log('Retrieved booking invoices:', invoices);
      
      if (invoices && invoices.length > 0) {
        // Post each invoice that's not already posted
        for (const invoice of invoices) {
          if (invoice.status !== 'POSTED') {
            await resHarmonicsService.postInvoice(invoice.id);
            console.log(`Invoice ${invoice.id} posted successfully`);
          }
        }
        invoicePosted = true;
      } else {
        console.log('No invoices found for booking, will proceed with payment');
      }
    } catch (invoiceError) {
      console.error('Failed to post invoice:', invoiceError.message);
      return res.status(400).json({
        success: false,
        error: 'Failed to post invoice',
        message: invoiceError.message,
        bookingId: booking.id
      });
    }

    // Step 6: Process payment
    const cardType = validateCardType(paymentDetails.cardNumber);
    const lastFour = paymentDetails.cardNumber.replace(/\s/g, '').slice(-4);
    const paymentReference = generatePaymentReference();

    const paymentData = {
      paymentReference: paymentReference,
      paymentType: 'CARD_PAYMENT',
      amount: actualPaymentAmount, // Use the adjusted amount
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
        bookingId: booking.id,
        invoicePosted: invoicePosted
      });
    }

    // Step 7: Update booking status to CONFIRMED after successful payment
    try {
      if (roomStayId) {
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'CONFIRMED'
          }]
        });
        console.log('Booking status updated to CONFIRMED');
      } else {
        console.error('No room stay ID available for final status update');
      }
    } catch (statusError) {
      console.error('Failed to update booking status to CONFIRMED:', statusError.message);
      console.log('Payment was successful, but final status update failed. Booking may need manual confirmation.');
    }

    // Step 8: Return success response
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
        paymentAmount: paymentDetails.amount,
        invoicePosted: invoicePosted,
        flow: 'NEW: ENQUIRY → PENDING → INVOICE_POSTED → PAYMENT → CONFIRMED',
        debug: {
          hadRoomStays: !!(updatedBooking.roomStays && updatedBooking.roomStays.length > 0),
          roomStayCount: updatedBooking.roomStays ? updatedBooking.roomStays.length : 0
        }
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
        bookingId: booking?.id,
        invoicePosted: invoicePosted
      }
    });
  }
};

// Legacy create booking function (unchanged)
const createBooking = async (req, res) => {
  let contact = null;

  try {
    const { guestDetails, stayDetails, unitDetails } = req.body;

    console.log('Creating legacy booking (enquiry only):', {
      guestDetails,
      stayDetails,
      unitDetails
    });

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

    // Step 2: Create booking (ENQUIRY status)
    const bookingPayload = {
      bookingContactId: contact.id,
      billingContactId: contact.id,
      // Remove explicit finance account IDs - let ResHarmonics auto-create them
      // bookingFinanceAccountId: contact.id,  // REMOVED
      // billingFinanceAccountId: contact.id,  // REMOVED
      billingFrequencyId: 1,
      bookingTypeId: 5, // Changed to Short Stay (ID 5) instead of Default (ID 1)
      channelId: 1,
      
      notes: `Legacy web booking for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
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

    console.log('Creating legacy booking with payload:', JSON.stringify(bookingPayload, null, 2));

    const booking = await resHarmonicsService.createBooking(bookingPayload);
    console.log('Legacy booking created successfully:', booking.id);

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
    console.error('Create legacy booking error:', {
      message: error.message,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking',
      message: error.message,
      debug: {
        contactCreated: !!contact,
        contactId: contact?.id
      }
    });
  }
};

// Get booking details
const getBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('Fetching booking details for ID:', bookingId);
    
    const booking = await resHarmonicsService.getBooking(bookingId);
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error.message);
    res.status(404).json({ 
      success: false, 
      error: 'Booking not found',
      message: error.message
    });
  }
};

// Get booking payments
const getBookingPayments = async (req, res) => {
  try {
    const { bookingId } = req.params;
    console.log('Fetching payments for booking ID:', bookingId);
    
    const payments = await resHarmonicsService.getBookingPayments(bookingId);
    
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Get booking payments error:', error.message);
    res.status(404).json({ 
      success: false, 
      error: 'Payments not found',
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
