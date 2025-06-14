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
      const authData = new URLSearchParams({
        grant_type: 'password',
        username: this.username,
        password: this.password
      });

      console.log('Requesting new access token...');
      
      const response = await axios.post(this.authURL, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer
      
      console.log('Access token obtained successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Auth error:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with RES:Harmonics');
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
      timeout: 30000 // 30 second timeout
    };

    if (data) {
      config.data = data;
    }

    try {
      console.log(`Making ${method} request to: ${endpoint}`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API Request Error:', {
        endpoint,
        method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(`RES:Harmonics API error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Search for availability
  async searchAvailability({ dateFrom, dateTo, guests = 1, inventoryType = 'UNIT_TYPE' }) {
    const params = new URLSearchParams({
      dateFrom,
      dateTo,
      guests: guests.toString(),
      inventoryType
    });
    
    return await this.makeRequest(`/api/v3/availabilities?${params}`);
  }

  // Get building details
  async getBuildings() {
    return await this.makeRequest('/api/v3/buildings');
  }

  // Get unit types
  async getUnitTypes() {
    return await this.makeRequest('/api/v3/unitTypes');
  }

  // Create booking (simplified without payment)
  async createBooking(bookingData) {
    return await this.makeRequest('/api/v3/bookings', 'POST', bookingData);
  }

  // Update booking status
  async updateBookingStatus(bookingId, statusData) {
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/updateStatuses`, 'PUT', statusData);
  }

  // Get booking details
  async getBooking(bookingId) {
    return await this.makeRequest(`/api/v3/bookings/${bookingId}`);
  }

  // Create contact
  async createContact(contactData) {
    return await this.makeRequest('/api/v3/contacts', 'POST', contactData);
  }
}

module.exports = new ResHarmonicsService();