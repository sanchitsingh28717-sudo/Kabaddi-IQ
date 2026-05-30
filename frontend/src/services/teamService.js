import { request } from './apiClient';

export const teamService = {
  /**
   * Retrieve all participating team franchises and seasonal stats summaries.
   */
  async getTeams() {
    return request('/api/teams');
  },

  /**
   * Retrieve all player profiles associated with a specific team franchise.
   * 
   * @param {string} teamId - Team franchise ID
   */
  async getTeamPlayers(teamId) {
    return request(`/api/teams/${teamId}/players`);
  },
};
