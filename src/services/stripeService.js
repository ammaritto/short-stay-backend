const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class StripeService {
  // Create a payment intent
  async createPaymentIntent(amount, currency = 'SEK', metadata = {}) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          ...metadata,
          source: 'short-stay-booking'
        }
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error('Stripe payment intent creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify payment status
  async verifyPayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethod: paymentIntent.payment_method,
        metadata: paymentIntent.metadata
      };
    } catch (error) {
      console.error('Payment verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Refund a payment
  async refundPayment(paymentIntentId, amount = null) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
      };
      
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }
      
      const refund = await stripe.refunds.create(refundData);
      
      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      };
    } catch (error) {
      console.error('Refund failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new StripeService();