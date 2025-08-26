// Updated src/controllers/bookingController.js
// Added Zapier webhook integration after successful booking confirmation

const resHarmonicsService = require('../services/resharmonicsService');
const stripeService = require('../services/stripeService');
const axios = require('axios');

// Zapier webhook URL
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/10018240/ut0ho3w/';

// Function to send data to Zapier webhook
const sendToZapier = async (bookingData) => {
  try {
    console.log('Sending booking data to Zapier webhook...');
    
    const webhookPayload = {
      Name: bookingData.firstName,
      Surname: bookingData.lastName,
      EmailAddress: bookingData.email,
      PhoneNumber: bookingData.phone || '',
      CheckInDate: bookingData.checkIn,
      CheckOutDate: bookingData.checkOut,
      PropertyInfo: bookingData.propertyInfo,
      TotalFee: bookingData.totalFee,
      Currency: bookingData.currency,
      BookingReference: bookingData.bookingReference,
      PaymentReference: bookingData.paymentReference,
      BookingId: bookingData.bookingId
    };

    console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await axios.post(ZAPIER_WEBHOOK_URL, webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ Zapier webhook sent successfully:', response.status);
    return { success: true, status: response.status };

  } catch (error) {
    console.error('❌ Failed to send Zapier webhook:', error.message);
    return { success: false, error: error.message };
  }
};
const axios = require('axios');

// Zapier webhook URL
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/10018240/ut0ho3w/';

// Function to send data to Zapier webhook
const sendToZapier = async (bookingData) => {
  try {
    console.log('Sending booking data to Zapier webhook...');
    
    const webhookPayload = {
      Name: bookingData.firstName,
      Surname: bookingData.lastName,
      EmailAddress: bookingData.email,
      PhoneNumber: bookingData.phone || '',
      CheckInDate: bookingData.checkIn,
      CheckOutDate: bookingData.checkOut,
      PropertyInfo: bookingData.propertyInfo,
      TotalFee: bookingData.totalFee,
      Currency: bookingData.currency,
      BookingReference: bookingData.bookingReference,
      PaymentReference: bookingData.paymentReference,
      BookingId: bookingData.bookingId
    };

    console.log('Webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await axios.post(ZAPIER_WEBHOOK_URL, webhookPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    console.log('✅ Zapier webhook sent successfully:', response.status);
    return { success: true, status: response.status };

  } catch (error) {
    console.error('❌ Failed to send Zapier webhook:', error.message);
    return { success: false, error: error.message };
  }
};

// UPDATED MAIN FUNCTION: Create booking with Stripe payment only
const createBookingWithPayment = async (req, res) => {
  let contact = null;
  let booking = null;
  let invoicePosted = false;

  try {
    const { guestDetails, stayDetails, unitDetails, paymentDetails, stripePaymentIntentId } = req.body;

    console.log('Creating booking with Stripe payment:', {
      guestDetails,
      stayDetails,
      unitDetails,
      paymentAmount: paymentDetails?.amount,
      stripePaymentIntentId: stripePaymentIntentId
    });

    // Validate required fields
    if (!paymentDetails || !paymentDetails.amount) {
      return res.status(400).json({
        success: false,
        error: 'Payment details are required',
        message: 'Payment amount must be provided'
      });
    }

    // REQUIRE Stripe payment intent ID
    if (!stripePaymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Stripe payment required',
        message: 'Stripe payment intent ID must be provided. Please complete payment through Stripe first.'
      });
    }

    const paymentAmount = parseFloat(paymentDetails.amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment amount',
        message: 'Payment amount must be greater than 0'
      });
    }

    // Step 1: Verify Stripe payment FIRST (before creating anything in ResHarmonics)
    console.log('Verifying Stripe payment:', stripePaymentIntentId);
    const stripeVerification = await stripeService.verifyPayment(stripePaymentIntentId);
    
    if (!stripeVerification.success) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
        message: stripeVerification.error
      });
    }

    if (stripeVerification.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed',
        message: `Payment status: ${stripeVerification.status}. Please complete the payment and try again.`
      });
    }

    // Verify amount matches
    if (Math.abs(stripeVerification.amount - paymentAmount) > 0.01) {
      return res.status(400).json({
        success: false,
        error: 'Payment amount mismatch',
        message: `Expected ${paymentAmount} ${stripeVerification.currency}, but payment was for ${stripeVerification.amount} ${stripeVerification.currency}`
      });
    }

    console.log('✅ Stripe payment verified successfully:', {
      paymentIntentId: stripePaymentIntentId,
      amount: stripeVerification.amount,
      currency: stripeVerification.currency,
      status: stripeVerification.status
    });

    // Now proceed with ResHarmonics booking creation
    let financeAccountId = null;

    // Step 2: Create contact in ResHarmonics
    try {
      contact = await resHarmonicsService.createContact(guestDetails);
      console.log('Contact created/found:', contact.id);
      
      // Extract finance account ID from contact response
      if (contact.contactSalesAccount && contact.contactSalesAccount.id) {
        financeAccountId = contact.contactSalesAccount.id;
        console.log('✅ Finance account created with contact:', financeAccountId);
      } else {
        financeAccountId = contact.id;
        console.log('⚠️ Using contact ID as finance account ID:', financeAccountId);
      }
      
    } catch (contactError) {
      console.error('Contact creation failed:', contactError.message);
      // Important: Payment has already been taken!
      return res.status(400).json({
        success: false,
        error: 'Failed to create guest contact',
        message: contactError.message,
        warning: 'Payment has been processed. Please contact support with payment reference: ' + stripePaymentIntentId
      });
    }

    // Step 3: Create booking in ResHarmonics
    const bookingPayload = {
      bookingContactId: contact.id,
      billingContactId: contact.id,
      bookingFinanceAccountId: financeAccountId,
      billingFinanceAccountId: financeAccountId,
      billingFrequencyId: 1,
      bookingTypeId: 5, // Short Stay
      channelId: 1,
      
      notes: `Web booking with Stripe payment ${stripePaymentIntentId} for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
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

    console.log('Creating booking in ResHarmonics...');

    try {
      booking = await resHarmonicsService.createBooking(bookingPayload);
      console.log('Booking created successfully (ENQUIRY status):', booking.id);
    } catch (bookingError) {
      console.error('Booking creation failed:', bookingError.message);
      // Payment has been taken but booking failed!
      return res.status(400).json({
        success: false,
        error: 'Failed to create booking',
        message: bookingError.message,
        contactId: contact.id,
        warning: 'Payment has been processed successfully. Please contact support with payment reference: ' + stripePaymentIntentId
      });
    }

    // Step 4: Update booking status to PENDING
    let roomStayId = null;
    try {
      const freshBooking = await resHarmonicsService.getBooking(booking.id);
      
      if (freshBooking.roomStays && freshBooking.roomStays.length > 0) {
        roomStayId = freshBooking.roomStays[0].roomStayId || freshBooking.roomStays[0].id;
        console.log(`Found room stay ID: ${roomStayId}`);
        
        if (freshBooking.roomStays[0].roomStayStatus === 'ENQUIRY') {
          await resHarmonicsService.updateBookingStatus(booking.id, {
            statusUpdates: [{
              roomStayId: roomStayId,
              status: 'PENDING'
            }]
          });
          console.log('Booking status updated to PENDING');
        }
      } else {
        // Try direct room stays endpoint
        const roomStays = await resHarmonicsService.getBookingRoomStays(booking.id);
        if (roomStays && roomStays.length > 0) {
          roomStayId = roomStays[0].roomStayId || roomStays[0].id;
          await resHarmonicsService.updateBookingStatus(booking.id, {
            statusUpdates: [{
              roomStayId: roomStayId,
              status: 'PENDING'
            }]
          });
          console.log('Booking status updated to PENDING');
        } else {
          console.error('No room stays found');
          // Continue anyway - payment is already taken
        }
      }
    } catch (statusError) {
      console.error('Failed to update booking status:', statusError.message);
      // Continue - don't fail the whole process
    }

    // Step 5: Post invoices
    try {
      const invoices = await resHarmonicsService.getBookingInvoices(booking.id);
      console.log(`Found ${invoices?.length || 0} invoices for booking`);
      
      if (invoices && invoices.length > 0) {
        const processedInvoiceIds = new Set();
        
        for (const invoice of invoices) {
          if (processedInvoiceIds.has(invoice.id)) continue;
          
          if (invoice.status !== 'POSTED') {
            await resHarmonicsService.postInvoice(invoice.id);
            console.log(`Invoice ${invoice.id} posted successfully`);
          }
          processedInvoiceIds.add(invoice.id);
        }
        invoicePosted = true;
      }
    } catch (invoiceError) {
      console.error('Invoice posting error:', invoiceError.message);
      // Continue - payment is already taken
    }

    // Step 6: Record the Stripe payment in ResHarmonics
    const paymentData = {
      paymentReference: stripePaymentIntentId, // Use Stripe Payment Intent ID as reference
      paymentType: 'CARD_PAYMENT',
      amount: paymentAmount,
      lastFour: paymentDetails.lastFour || '****',
      cardType: paymentDetails.cardType || 'VISA_CREDIT'
    };

    console.log('Recording Stripe payment in ResHarmonics:', paymentData);

    try {
      const paymentResult = await resHarmonicsService.createBookingPayment(booking.id, paymentData);
      console.log('Payment recorded successfully in ResHarmonics');
    } catch (paymentError) {
      console.error('Failed to record payment in ResHarmonics:', paymentError.message);
      // Payment was successful in Stripe, just failed to record in ResHarmonics
      // Continue but note this in the response
    }

    // Step 7: Update booking status to CONFIRMED
    try {
      if (roomStayId) {
        await resHarmonicsService.updateBookingStatus(booking.id, {
          statusUpdates: [{
            roomStayId: roomStayId,
            status: 'CONFIRMED'
          }]
        });
        console.log('Booking status updated to CONFIRMED');
      }
    } catch (statusError) {
      console.error('Failed to update final status:', statusError.message);
      // Continue - payment is successful
    }

    // Step 8: Send data to Zapier webhook
    const webhookData = {
      firstName: guestDetails.firstName,
      lastName: guestDetails.lastName,
      email: guestDetails.email,
      phone: guestDetails.phone || '',
      checkIn: stayDetails.startDate,
      checkOut: stayDetails.endDate,
      propertyInfo: `${unitDetails.buildingName || 'Property'} - ${unitDetails.inventoryTypeName || unitDetails.rateName || 'Unit'}`,
      totalFee: paymentAmount,
      currency: stripeVerification.currency,
      bookingReference: booking.bookingReference,
      paymentReference: stripePaymentIntentId,
      bookingId: booking.id
    };

    const webhookResult = await sendToZapier(webhookData);
    console.log('Zapier webhook result:', webhookResult);

    // Step 9: Return success response
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
        paymentReference: stripePaymentIntentId,
        paymentAmount: paymentAmount,
        paymentCurrency: stripeVerification.currency,
        invoicePosted: invoicePosted,
        webhookSent: webhookResult.success,
        message: 'Booking confirmed and payment processed successfully'
      }
    });

  } catch (error) {
    console.error('Create booking with payment error:', {
      message: error.message,
      stripePaymentIntentId: req.body.stripePaymentIntentId
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking',
      message: error.message,
      warning: req.body.stripePaymentIntentId ? 
        'If payment was processed, please contact support with reference: ' + req.body.stripePaymentIntentId : 
        undefined,
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

// Legacy create booking function (NO PAYMENT - inquiry only)
const createBooking = async (req, res) => {
  let contact = null;

  try {
    const { guestDetails, stayDetails, unitDetails } = req.body;

    console.log('Creating inquiry booking (NO PAYMENT):', {
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

    // Step 2: Create booking (ENQUIRY status only)
    const bookingPayload = {
      bookingContactId: contact.id,
      billingContactId: contact.id,
      bookingFinanceAccountId: contact.id,
      billingFinanceAccountId: contact.id,
      billingFrequencyId: 1,
      bookingTypeId: 5, // Short Stay
      channelId: 1,
      
      notes: `Web inquiry (no payment) for ${guestDetails.firstName} ${guestDetails.lastName}`,
      
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

    const booking = await resHarmonicsService.createBooking(bookingPayload);
    console.log('Inquiry booking created successfully:', booking.id);

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingReference: booking.bookingReference,
        status: 'enquiry',
        guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
        checkIn: stayDetails.startDate,
        checkOut: stayDetails.endDate,
        contactId: contact.id,
        message: 'Booking inquiry created. Payment required to confirm.'
      }
    });

  } catch (error) {
    console.error('Create inquiry booking error:', {
      message: error.message,
      requestBody: req.body
    });
    
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create booking inquiry',
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
