const createBooking = async (req, res) => {
  try {
    const { guestDetails, stayDetails } = req.body;

    console.log('Booking request received:', {
      guest: guestDetails?.firstName + ' ' + guestDetails?.lastName,
      email: guestDetails?.email,
      checkIn: stayDetails?.startDate,
      checkOut: stayDetails?.endDate,
      inventoryTypeId: stayDetails?.inventoryTypeId,
      rateId: stayDetails?.rateId
    });

    // Return a mock success response for now
    const mockBooking = {
      bookingId: 'BK' + Date.now(),
      bookingReference: 'REF' + Math.floor(Math.random() * 10000),
      status: 'enquiry',
      guestName: `${guestDetails.firstName} ${guestDetails.lastName}`,
      checkIn: stayDetails.startDate,
      checkOut: stayDetails.endDate
    };

    console.log('Mock booking created:', mockBooking);

    res.json({
      success: true,
      data: mockBooking
    });

  } catch (error) {
    console.error('Booking error:', error);
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
    
    res.json({
      success: true,
      data: {
        id: bookingId,
        status: 'enquiry',
        message: 'Mock booking data'
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
