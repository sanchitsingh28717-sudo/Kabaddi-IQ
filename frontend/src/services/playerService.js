import { request } from './apiClient';

export const playerService = {
  /**
   * Retrieve player profiles list with optional filters.
   * 
   * @param {string} [position] - Player position filter
   * @param {string} [team] - Team ID filter
   */
  async getPlayers(position, team) {
    let endpoint = '/api/players';
    const params = [];
    if (position) params.push(`position=${encodeURIComponent(position)}`);
    if (team) params.push(`team=${encodeURIComponent(team)}`);
    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }
    return request(endpoint);
  },

  /**
   * Retrieve a detailed player profile by their ID.
   * 
   * @param {string} id - Player profile ID
   */
  async getPlayerById(id) {
    return request(`/api/players/${id}`);
  },

  /**
   * Create a new player profile database entry.
   * 
   * @param {object} playerData - Player profile details
   */
  async createPlayer(playerData) {
    return request('/api/players', {
      method: 'POST',
      body: JSON.stringify(playerData),
    });
  },

  /**
   * Update properties of an existing player profile by ID.
   * 
   * @param {string} id - Player profile ID
   * @param {object} playerData - Properties to update (name, position, photo_url)
   */
  async updatePlayer(id, playerData) {
    return request(`/api/players/${id}`, {
      method: 'PUT',
      body: JSON.stringify(playerData),
    });
  },
};
