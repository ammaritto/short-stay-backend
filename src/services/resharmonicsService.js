// Replace the createContact method in your resharmonicsService.js

async createContact(contactData) {
  // Simplified contact structure focusing on what works
  const contactPayload = {
    firstName: contactData.firstName,
    lastName: contactData.lastName,
    
    // Primary email and phone (direct fields)
    primaryEmailAddress: contactData.email,
    primaryTelephoneNumber: contactData.phone,
    
    // Array format for email addresses
    contactEmailAddresses: [{
      email: contactData.email,
      primary: true,
      type: "PERSONAL"
    }],
    
    // Array format for phone numbers (only if phone exists)
    contactTelephoneNumbers: contactData.phone ? [{
      number: contactData.phone,
      primary: true,
      type: "MOBILE"
    }] : [],
    
    // Contact type
    contactType: "GUEST",
    
    // Empty address array (required field)
    contactAddresses: []
  };

  console.log('Creating contact with fixed payload:', JSON.stringify(contactPayload, null, 2));
  
  return await this.makeRequest('/api/v3/contacts', 'POST', contactPayload);
}
