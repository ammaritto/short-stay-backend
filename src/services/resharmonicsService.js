const axios = require('axios');

class ResHarmonicsService {
  constructor() {
    this.baseURL = process.env.RH_BASE_URL;
    this.authURL = process.env.RH_AUTH_URL;
    this.username = process.env.RH_USERNAME;
    this.password = process.env.RH_PASSWORD;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('Fetching new access token...');
      const response = await axios.post(this.authURL, {
        username: this.username,
        password: this.password
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
      
      console.log('Access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Authentication failed. Status:', error.response?.status);
      console.error('Error message:', error.message);
      
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

        const endpoint = `/api/v3/rates/availability?${params.toString()}`;
        const data = await this.makeRequest(endpoint);
        
        if (data._embedded?.ratesAvailabilityItems) {
          console.log(`Found ${data._embedded.ratesAvailabilityItems.length} items for ${rateCode}`);
          allResults.push(...data._embedded.ratesAvailabilityItems);
        } else {
          console.log(`No availability found for rate code: ${rateCode}`);
        }
      } catch (error) {
        console.error(`Failed to fetch availability for ${rateCode}:`, error.message);
        failedRateCodes.push(rateCode);
        continue;
      }
    }

    const uniqueResults = Array.from(
      new Map(allResults.map(item => [`${item.inventoryType.id}-${item.rate.id}`, item])).values()
    );

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
