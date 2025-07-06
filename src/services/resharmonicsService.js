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
      
      // OAuth2 Client Credentials flow (matching your Postman setup)
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
          // Send client credentials as Basic Auth header (matching Postman)
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        },
        timeout: 15000
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min buffer
      
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

  // Get areas (like in your Postman)
  async getAreas() {
    return await this.makeRequest('/api/v3/areas');
  }

  // Get unit types
  async getUnitTypes() {
    return await this.makeRequest('/api/v3/unitTypes');
  }

  // Create booking
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
  // Updated contact structure to match RES:Harmonics API
  const contactPayload = {
    firstName: contactData.firstName,
    lastName: contactData.lastName,
    contactEmailAddresses: contactData.contactEmailAddresses || [{
      email: contactData.email || contactData.emailAddress,
      primary: true,
      type: "PERSONAL"
    }],
    contactTelephoneNumbers: contactData.contactTelephoneNumbers || (contactData.phone ? [{
      number: contactData.phone || contactData.phoneNumber,
      primary: true,
      type: "MOBILE"
    }] : []),
    contactType: "GUEST", // Specify contact type
    title: contactData.title || null,
    dateOfBirth: contactData.dateOfBirth || null,
    nationality: contactData.nationality || null,
    contactAddresses: contactData.contactAddresses || [] // Empty array if no address
  };

  console.log('Creating contact with payload:', JSON.stringify(contactPayload, null, 2));
  
  return await this.makeRequest('/api/v3/contacts', 'POST', contactPayload);
}

module.exports = new ResHarmonicsService();
