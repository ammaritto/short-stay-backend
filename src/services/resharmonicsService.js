const axios = require('axios');

class ResHarmonicsService {
  constructor() {
    this.baseURL = process.env.RH_BASE_URL;
    this.authURL = process.env.RH_AUTH_URL;
    this.clientId = process.env.RH_CLIENT_ID;
    this.clientSecret = process.env.RH_CLIENT_SECRET;
    this.scope = process.env.RH_SCOPE || 'api/read api/write';
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Debug logging
    console.log('RESharmonics Service initialized with:');
    console.log('- Auth URL:', this.authURL);
    console.log('- Base URL:', this.baseURL);
    console.log('- Client ID exists:', !!this.clientId);
    console.log('- Client Secret exists:', !!this.clientSecret);
    console.log('- Scope:', this.scope);
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      console.log('Using cached access token');
      return this.accessToken;
    }

    try {
      console.log('Requesting new access token using OAuth2 Client Credentials...');
      
      const authData = new URLSearchParams({
        grant_type: 'client_credentials',
        scope: this.scope
      });

      console.log('Auth request data:', {
        grant_type: 'client_credentials',
        scope: this.scope,
        client_id: this.clientId?.substring(0, 5) + '...',
        using_basic_auth: true
      });
      
      const response = await axios.post(this.authURL, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        timeout: 15000
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      
      console.log('Access token obtained successfully');
      console.log('Token expires in:', response.data.expires_in, 'seconds');
      console.log('Token type:', response.data.token_type);
      
      return this.accessToken;
    } catch (error) {
      console.error('OAuth2 Authentication Error:');
      console.error('- URL:', this.authURL);
      console.error('- Status:', error.response?.status);
      console.error('- Status Text:', error.response?.statusText);
      console.error('- Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('- Request headers:', error.config?.headers);
      console.error('- Error message:', error.message);
      
      throw new Error(`Failed to authenticate with RES:Harmonics: ${error.response?.status} ${error.response?.statusText || error.message}`);
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const token = await this.getAccessToken();
    
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    if (data) {
      config.data = data;
    }

    try {
      console.log(`Making ${method} request to: ${this.baseURL}${endpoint}`);
      const response = await axios(config);
      console.log('Request successful, response status:', response.status);
      return response.data;
    } catch (error) {
      console.error('API Request Error:', {
        endpoint,
        method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`RES:Harmonics API error: ${error.response?.status} ${error.response?.statusText} - ${error.response?.data?.message || error.message}`);
    }
  }

  async searchAvailability({ dateFrom, dateTo, guests = 1, inventoryType = 'UNIT_TYPE' }) {
    const webRateCodes = ['BRO-SP-WEB', 'BRO-S-WEB', 'ANG-S-WEB'];
    console.log('Searching availability for WEB rate codes:', webRateCodes);
    
    const allResults = [];
    const failedRateCodes = [];
    
    for (const rateCode of webRateCodes) {
      try {
        console.log(`Fetching availability for rate code: ${rateCode}`);
        
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          guests: guests.toString(),
          inventoryType,
          rateCode
        });

        // FIXED: Use correct endpoint /api/v3/availabilities instead of /api/v3/rates/availability
        const endpoint = `/api/v3/availabilities?${params.toString()}`;
        const data = await this.makeRequest(endpoint);
        
        if (data.content && data.content.length > 0) {
          console.log(`Found ${data.content.length} items for ${rateCode}`);
          allResults.push(...data.content);
        } else {
          console.log(`No availability found for rate code: ${rateCode}`);
        }
      } catch (error) {
        console.error(`Failed to fetch availability for ${rateCode}:`, error.message);
        failedRateCodes.push(rateCode);
        continue;
      }
    }

    // Remove duplicates based on building + inventory type + rate combination
    const uniqueResults = [];
    const seen = new Set();
    
    for (const property of allResults) {
      for (const rate of property.rateAvailabilities || []) {
        const key = `${property.buildingId}-${property.inventoryTypeId}-${rate.rateId}`;
        if (!seen.has(key)) {
          seen.add(key);
          
          // Find if we already have this property in uniqueResults
          let existingProperty = uniqueResults.find(p => 
            p.buildingId === property.buildingId && 
            p.inventoryTypeId === property.inventoryTypeId
          );
          
          if (existingProperty) {
            // Add the rate to existing property
            existingProperty.rateAvailabilities.push(rate);
          } else {
            // Create new property with this rate
            uniqueResults.push({
              ...property,
              rateAvailabilities: [rate]
            });
          }
        }
      }
    }

    console.log(`Total unique properties with WEB rates: ${uniqueResults.length}`);
    
    return {
      content: uniqueResults,
      total: uniqueResults.length,
      searchInfo: {
        searchedRateCodes: webRateCodes,
        failedRateCodes: failedRateCodes,
        totalPropertiesFound: uniqueResults.length
      }
    };
  }

  async getBuildings() {
    return await this.makeRequest('/api/v3/buildings');
  }

  async getAreas() {
    return await this.makeRequest('/api/v3/areas');
  }

  async getUnitTypes() {
    return await this.makeRequest('/api/v3/unitTypes');
  }

  async createBooking(bookingData) {
    return await this.makeRequest('/api/v3/bookings', 'POST', bookingData);
  }

  async updateBookingStatus(bookingId, statusData) {
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/updateStatuses`, 'PUT', statusData);
  }

  async getBooking(bookingId) {
    return await this.makeRequest(`/api/v3/bookings/${bookingId}`);
  }

  // NEW PAYMENT METHODS
  async createBookingPayment(bookingId, paymentData) {
    console.log(`Creating payment for booking ${bookingId}:`, paymentData);
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/payments`, 'POST', paymentData);
  }

  async getBookingPayments(bookingId) {
    console.log(`Fetching payments for booking ${bookingId}`);
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/payments`);
  }

  // Contact creation method
  async createContact(contactData) {
    const contactPayload = {
      firstName: contactData.firstName,
      lastName: contactData.lastName,
      
      primaryContactEmailAddress: {
        email: contactData.email,
        primary: true
      },
      
      type: "GUEST",
      source: "ONLINE_BOOKING",
      status: "ACTIVE",
      lifecycleStage: "LEAD",
      marketingOptOut: false,
      preferredContactMethod: "EMAIL"
    };

    if (contactData.phone) {
      contactPayload.primaryContactTelephoneNumber = {
        number: contactData.phone,
        primary: true
      };
    }

    console.log('Creating contact with correct API structure:', JSON.stringify(contactPayload, null, 2));
    
    return await this.makeRequest('/api/v3/contacts', 'POST', contactPayload);
  }
}

module.exports = new ResHarmonicsService();
