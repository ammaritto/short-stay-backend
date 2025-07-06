const { validationResult } = require('express-validator');
const resHarmonicsService = require('../services/resharmonicsService');

const searchAvailability = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    const { startDate, endDate, guests } = req.query;
    
    console.log('Searching availability:', { startDate, endDate, guests });
    
    const availability = await resHarmonicsService.searchAvailability({
      dateFrom: startDate,
      dateTo: endDate,
      guests: parseInt(guests) || 1,
      inventoryType: 'UNIT_TYPE'
    });
    
    // Transform the data for frontend consumption
    const transformedData = availability.content?.map(property => ({
      buildingId: property.buildingId,
      buildingName: property.buildingName,
      inventoryType: property.inventoryType,
      inventoryTypeId: property.inventoryTypeId,
      inventoryTypeName: property.inventoryTypeName,
      rates: property.rateAvailabilities?.map(rate => ({
        rateId: rate.rateId,
        rateCode: rate.rateCode,  // Add this line
        rateName: rate.shortName || rate.description,
        currency: rate.currencyCode,
        currencySymbol: rate.currencySymbol,
        totalPrice: rate.totals,
        avgNightlyRate: rate.avgRate,
        nights: rate.nights,
        description: rate.webDescription || rate.description,
        bookingTerms: rate.bookingTerms
      })) || []
    })) || [];

    res.json({
      success: true,
      data: transformedData,
      searchParams: { startDate, endDate, guests },
      total: transformedData.length
    });
  } catch (error) {
    console.error('Availability search error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search availability',
      message: error.message 
    });
  }
};

const getBuildings = async (req, res) => {
  try {
    console.log('Fetching buildings...');
    const buildings = await resHarmonicsService.getBuildings();
    
    const transformedBuildings = buildings.content?.map(building => ({
      id: building.id,
      name: building.buildingName,
      address: `${building.addressLine1}${building.addressLine2 ? ', ' + building.addressLine2 : ''}`,
      city: building.city,
      postCode: building.postCode
    })) || [];

    res.json({
      success: true,
      data: transformedBuildings,
      total: transformedBuildings.length
    });
  } catch (error) {
    console.error('Get buildings error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch buildings',
      message: error.message 
    });
  }
};

module.exports = {
  searchAvailability,
  getBuildings
};
