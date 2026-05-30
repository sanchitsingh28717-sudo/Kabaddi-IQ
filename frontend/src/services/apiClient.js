const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Perform an HTTP request to the backend server with standard configurations.
 * 
 * @param {string} endpoint - The relative endpoint path (e.g. '/api/teams')
 * @param {RequestInit} [options] - Custom fetch configurations
 * @returns {Promise<any>} Response JSON data
 */
export async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `HTTP Error ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return await response.json();
  } catch (error) {
    console.error(`[API Client Error] Fetch failed for ${url}:`, error);
    throw error;
  }
}
