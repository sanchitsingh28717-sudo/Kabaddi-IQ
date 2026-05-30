import { request } from './apiClient';

export const predictionService = {
  /**
   * Retrieve completed match results logs.
   * 
   * @param {string} [team] - Filter results by team ID
   */
  async getFixtureResults(team) {
    let endpoint = '/api/fixtures/results';
    if (team) {
      endpoint += `?team=${encodeURIComponent(team)}`;
    }
    return request(endpoint);
  },

  /**
   * Retrieve scheduled upcoming match fixtures.
   */
  async getUpcomingFixtures() {
    return request('/api/fixtures/upcoming');
  },

  /**
   * Retrieve active league standings ranking.
   */
  async getLeagueTable() {
    return request('/api/league-table');
  },

  /**
   * Calculate live win probability using sequence-aware LSTM models.
   * 
   * @param {object} matchStateData - Live match parameters
   */
  async predictWinProbability(matchStateData) {
    return request('/api/predict/win-probability', {
      method: 'POST',
      body: JSON.stringify(matchStateData),
    });
  },

  /**
   * Evaluate tactical momentum for timeout recommendation.
   * 
   * @param {object} timeoutData - Live match parameters
   */
  async predictTimeout(timeoutData) {
    return request('/api/predict/timeout', {
      method: 'POST',
      body: JSON.stringify(timeoutData),
    });
  },

  /**
   * Predict pre-match outcome probabilities using Random Forest model.
   * 
   * @param {string} homeTeamId - Home team franchise ID
   * @param {string} awayTeamId - Away team franchise ID
   */
  async predictMatchOutcome(homeTeamId, awayTeamId) {
    return request('/api/predict/match-outcome', {
      method: 'POST',
      body: JSON.stringify({ home_team_id: homeTeamId, away_team_id: awayTeamId }),
    });
  },
};
