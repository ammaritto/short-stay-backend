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
      
      // Log detailed validation errors if available
      if (error.response?.data?.errors) {
        console.error('Detailed validation errors:', JSON.stringify(error.response.data.errors, null, 2));
      }
      
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  // Availability methods
  async searchAvailability(searchParams) {
    const webRateCodes = ['BRO-SP-WEB', 'BRO-S-WEB', 'ANG-S-WEB'];
    console.log('Searching availability for WEB rate codes:', webRateCodes);
    
    const allResults = [];
    const failedRateCodes = [];
    
    for (const rateCode of webRateCodes) {
      try {
        console.log(`Fetching availability for rate code: ${rateCode}`);
        
        const params = new URLSearchParams({
          dateFrom: searchParams.dateFrom,
          dateTo: searchParams.dateTo,
          guests: searchParams.guests.toString(),
          inventoryType: searchParams.inventoryType,
          rateCode
        });

        // CORRECT: Use /api/v3/availabilities endpoint
        const endpoint = `/api/v3/availabilities?${params.toString()}`;
        console.log(`Making availability request to: ${endpoint}`);
        
        const response = await this.makeRequest(endpoint, 'GET');
        
        if (response && response.content && response.content.length > 0) {
          console.log(`Found ${response.content.length} results for ${rateCode}`);
          allResults.push(...response.content);
        } else {
          console.log(`No results for rate code: ${rateCode}`);
        }
        
      } catch (error) {
        console.error(`Error fetching availability for ${rateCode}:`, error.message);
        failedRateCodes.push(rateCode);
      }
    }
    
    if (failedRateCodes.length > 0) {
      console.warn('Failed rate codes:', failedRateCodes);
    }
    
    console.log(`Total availability results: ${allResults.length}`);
    
    return {
      content: allResults,
      totalElements: allResults.length,
      searchParams: searchParams,
      failedRateCodes: failedRateCodes
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

  // Booking methods
  async createBooking(bookingData) {
    return await this.makeRequest('/api/v3/bookings', 'POST', bookingData);
  }

  async updateBookingStatus(bookingId, statusData, userDetails = null) {
    // Try without user parameters first (some ResHarmonics setups don't require them)
    try {
      console.log('Attempting status update without user parameters...');
      const simpleEndpoint = `/api/v3/bookings/${bookingId}/updateStatuses`;
      return await this.makeRequest(simpleEndpoint, 'PUT', statusData);
    } catch (simpleError) {
      console.log('Simple status update failed, trying with user parameters...');
      
      // Fallback to user parameters with minimal required fields
      const defaultUser = userDetails || {
        userId: 1,
        enabled: true,
        username: "system",
        accountNonExpired: true,
        accountNonLocked: true,
        credentialsNonExpired: true
      };

      // Build query parameters with minimal set
      const queryParams = new URLSearchParams({
        'user.userId': defaultUser.userId.toString(),
        'user.enabled': defaultUser.enabled.toString(),
        'user.username': defaultUser.username,
        'user.accountNonExpired': defaultUser.accountNonExpired.toString(),
        'user.accountNonLocked': defaultUser.accountNonLocked.toString(),
        'user.credentialsNonExpired': defaultUser.credentialsNonExpired.toString()
      });

      console.log('Status update query params:', queryParams.toString());
      const endpoint = `/api/v3/bookings/${bookingId}/updateStatuses?${queryParams.toString()}`;
      return await this.makeRequest(endpoint, 'PUT', statusData);
    }
  }

  async getBooking(bookingId) {
    const booking = await this.makeRequest(`/api/v3/bookings/${bookingId}`);
    
    // If no room stays in main response, fetch them separately
    if (!booking.roomStays || booking.roomStays.length === 0) {
      console.log('No room stays in main booking response, fetching separately...');
      try {
        const roomStays = await this.getBookingRoomStays(bookingId);
        booking.roomStays = roomStays;
        console.log(`Added ${roomStays.length} room stays to booking object`);
      } catch (error) {
        console.warn('Failed to fetch room stays separately:', error.message);
      }
    }
    
    return booking;
  }

  // NEW: Get room stays for a booking
  async getBookingRoomStays(bookingId) {
    console.log(`Fetching room stays for booking ${bookingId}`);
    try {
      const response = await this.makeRequest(`/api/v3/bookings/${bookingId}/roomStays`);
      
      // Handle different response structures
      let roomStays = [];
      if (response && response.content && Array.isArray(response.content)) {
        roomStays = response.content;
      } else if (response && Array.isArray(response)) {
        roomStays = response;
      } else if (response && response._embedded && response._embedded.roomStays) {
        roomStays = response._embedded.roomStays;
      }
      
      console.log(`Found ${roomStays.length} room stays for booking ${bookingId}`);
      return roomStays;
    } catch (error) {
      console.error('Failed to get booking room stays:', error.message);
      throw error;
    }
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

  // Contact creation method - FIXED VERSION without contactSalesAccount
  async createContact(contactData) {
    // Create contact without problematic contactSalesAccount field
    const basicContactPayload = {
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
      basicContactPayload.primaryContactTelephoneNumber = {
        number: contactData.phone,
        primary: true
      };
    }

    console.log('🔧 FIXED: Creating contact WITHOUT contactSalesAccount:', JSON.stringify(basicContactPayload, null, 2));
    
    try {
      const contact = await this.makeRequest('/api/v3/contacts', 'POST', basicContactPayload);
      console.log('✅ Contact created successfully:', contact.id);
      
      // After contact creation, try to create finance account separately
      if (contact.id) {
        try {
          console.log('🔄 Attempting to create finance account separately...');
          const financeAccount = await this.createFinanceAccountForContact(contact.id);
          if (financeAccount && financeAccount.id) {
            // Add the finance account info to the contact response
            contact.contactSalesAccount = financeAccount;
            console.log('✅ Finance account created separately:', financeAccount.id);
          }
        } catch (financeError) {
          console.log('⚠️ Separate finance account creation failed, will use contact ID:', financeError.message);
          // Not critical - we can proceed with contact ID as finance account ID
        }
      }
      
      return contact;
      
    } catch (basicError) {
      console.log('❌ Basic contact creation failed:', basicError.message);
      throw basicError;
    }
  }

  // Try to create a finance account specifically for this contact
  async createFinanceAccountForContact(contactId) {
    console.log(`Attempting to create finance account for contact ${contactId}`);
    
    // Try different endpoints that might work for finance account creation
    const possibleEndpoints = [
      `/api/v3/contacts/${contactId}/financeAccounts`,
      `/api/v3/financeAccounts`,
      `/api/v3/accounts`
    ];
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying finance account creation via: ${endpoint}`);
        
        let payload;
        if (endpoint.includes('financeAccounts')) {
          payload = { contactId: contactId };
        } else {
          payload = { 
            contactId: contactId,
            type: 'CUSTOMER',
            status: 'ACTIVE'
          };
        }
        
        const result = await this.makeRequest(endpoint, 'POST', payload);
        console.log(`✅ Finance account created via ${endpoint}:`, result);
        return result;
        
      } catch (error) {
        console.log(`❌ Finance account creation failed via ${endpoint}:`, error.message);
      }
    }
    
    throw new Error('All finance account creation attempts failed');
  }

  // Get existing finance accounts for all contacts (to find a pattern)
  async searchFinanceAccounts(contactId = null) {
    console.log('Searching for finance accounts...');
    try {
      let endpoint = '/api/v3/financeAccounts';
      if (contactId) {
        endpoint += `?contactId=${contactId}`;
      }
      
      const result = await this.makeRequest(endpoint);
      console.log('Finance accounts search result:', JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.warn('Finance accounts search failed:', error.message);
      return null;
    }
  }
}

module.exports = new ResHarmonicsService();
