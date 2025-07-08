// Updated src/services/resharmonicsService.js
// Added new methods for invoice posting and booking invoice retrieval

const axios = require('axios');

class ResHarmonicsService {
  constructor() {
    this.accessToken = null;
    this.tokenExpires = null;
    this.baseURL = process.env.RH_BASE_URL;
    this.clientId = process.env.RH_CLIENT_ID;
    this.clientSecret = process.env.RH_CLIENT_SECRET;
    this.authURL = process.env.RH_AUTH_URL;
    this.scope = process.env.RH_SCOPE || 'api/read api/write';
  }

  async authenticate() {
    if (this.accessToken && this.tokenExpires && Date.now() < this.tokenExpires) {
      return this.accessToken;
    }

    try {
      const authData = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: this.scope
      });

      console.log('Authenticating with ResHarmonics...');
      
      const response = await axios.post(this.authURL, authData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpires = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 minute buffer
      
      console.log('Authentication successful');
      return this.accessToken;
    } catch (error) {
      console.error('Authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with ResHarmonics API');
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const token = await this.authenticate();
    
    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    try {
      console.log(`Making ${method} request to: ${endpoint}`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`API request failed:`, {
        endpoint,
        method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  // Availability methods
  async searchAvailability(searchParams) {
    const queryString = new URLSearchParams(searchParams).toString();
    return await this.makeRequest(`/api/v3/bookings/search?${queryString}`);
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

  // Booking methods
  async createBooking(bookingData) {
    return await this.makeRequest('/api/v3/bookings', 'POST', bookingData);
  }

  async updateBookingStatus(bookingId, statusData, userDetails = null) {
    // The API requires user details in query parameters
    const defaultUser = userDetails || {
      userId: 1,
      enabled: true,
      username: "api_user",
      password: "api_password",
      authorities: [],
      accountNonExpired: true,
      accountNonLocked: true,
      credentialsNonExpired: true
    };

    const queryParams = new URLSearchParams({
      'user.userId': defaultUser.userId.toString(),
      'user.enabled': defaultUser.enabled.toString(),
      'user.username': defaultUser.username,
      'user.password': defaultUser.password,
      'user.accountNonExpired': defaultUser.accountNonExpired.toString(),
      'user.accountNonLocked': defaultUser.accountNonLocked.toString(),
      'user.credentialsNonExpired': defaultUser.credentialsNonExpired.toString()
    });

    const endpoint = `/api/v3/bookings/${bookingId}/updateStatuses?${queryParams.toString()}`;
    return await this.makeRequest(endpoint, 'PUT', statusData);
  }

  async getBooking(bookingId) {
    return await this.makeRequest(`/api/v3/bookings/${bookingId}`);
  }

  // Payment methods
  async createBookingPayment(bookingId, paymentData) {
    console.log(`Creating payment for booking ${bookingId}:`, paymentData);
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/payments`, 'POST', paymentData);
  }

  async getBookingPayments(bookingId) {
    console.log(`Fetching payments for booking ${bookingId}`);
    return await this.makeRequest(`/api/v3/bookings/${bookingId}/payments`);
  }

  // NEW: Invoice methods
  async getBookingInvoices(bookingId) {
    console.log(`Fetching invoices for booking ${bookingId}`);
    try {
      // Use the correct endpoint for booking invoices
      const response = await this.makeRequest(`/api/v3/bookings/${bookingId}/salesInvoices`);
      
      console.log('Invoice response structure:', JSON.stringify(response, null, 2));
      
      // Handle different response structures
      let invoices = [];
      if (response && response.content && Array.isArray(response.content)) {
        invoices = response.content;
      } else if (response && Array.isArray(response)) {
        invoices = response;
      } else if (response && response._embedded && response._embedded.salesInvoices) {
        invoices = response._embedded.salesInvoices;
      }
      
      console.log(`Found ${invoices.length} invoices for booking ${bookingId}`);
      return invoices;
    } catch (error) {
      console.error('Failed to get booking invoices:', error.message);
      throw error;
    }
  }

  async postInvoice(invoiceId) {
    console.log(`Posting invoice ${invoiceId}`);
    return await this.makeRequest(`/api/v3/salesInvoices/${invoiceId}/post`, 'PUT');
  }

  async getInvoice(invoiceId) {
    console.log(`Fetching invoice ${invoiceId}`);
    return await this.makeRequest(`/api/v3/salesInvoices/${invoiceId}`);
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
