const axios = require('axios');

class ResHarmonicsService {
  constructor() {
    this.baseURL = process.env.RH_BASE_URL;
    this.authURL = process.env.RH_AUTH_URL;
    this.username = process.env.RH_USERNAME;
    this.password = process.env.RH_PASSWORD;
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // Debug logging
    console.log('RESharmonics Service initialized with:');
    console.log('- Auth URL:', this.authURL);
    console.log('- Base URL:', this.baseURL);
    console.log('- Username exists:', !!this.username);
    console.log('- Password exists:', !!this.password);
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Try basic auth approach first
      console.log('Attempting Basic Auth approach...');
      
      try {
        const response = await axios.post(this.authURL, 
          new URLSearchParams({
            grant_type: 'client_credentials'
          }), 
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`
            },
            timeout: 10000
          }
        );
        
        console.log('Basic Auth successful');
        return response;
      } catch (basicAuthError) {
        console.log('Basic Auth failed, trying password grant...');
        
        // Fallback to original method
        const authData = new URLSearchParams({
          grant_type: 'password',
          username: this.username,
          password: this.password
        });

        console.log('Requesting new access token from:', this.authURL);
        console.log('Auth data:', { 
          grant_type: 'password', 
          username: this.username?.substring(0, 5) + '...', 
          password: this.password?.substring(0, 5) + '...' 
        });
        
        const response = await axios.post(this.authURL, authData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000 // 10 second timeout
        });
        
        return response;
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer
      
      console.log('Access token obtained successfully');
      console.log('Token expires in:', response.data.expires_in, 'seconds');
      return this.accessToken;
    } catch (error) {
      console.error('Auth error details:');
      console.error('- Status:', error.response?.status);
      console.error('- Status Text:', error.response?.statusText);
      console.error('- Response data:', error.response?.data);
      console.error('- Request config:', {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      });
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
      timeout: 30000 // 30 second timeout
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
