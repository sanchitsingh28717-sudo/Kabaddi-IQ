import { request } from './apiClient';

export const authService = {
  /**
   * Request an OTP recovery code via phone SMS or email.
   * 
   * @param {string} method - 'phone' | 'email'
   * @param {string} contact - Recipient phone or email contact address
   */
  async resetPassword(method, contact) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ method, contact }),
    });
  },

  /**
   * Submit and verify OTP decryption token to override access.
   * 
   * @param {string} contact - Recipient contact address
   * @param {string} otp - 6-digit verification code
   */
  async verifyOtp(contact, otp) {
    return request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ contact, otp }),
    });
  },
};
