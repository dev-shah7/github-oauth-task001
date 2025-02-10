const axios = require("axios");

const GITHUB_API_CONFIG = {
  baseURL: "https://api.github.com",
  headers: {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  },
};

const getAuthHeaders = (token) => ({
  ...GITHUB_API_CONFIG.headers,
  Authorization: `Bearer ${token}`,
});

const fetchGithubData = async (endpoint, token) => {
  return axios.get(`${GITHUB_API_CONFIG.baseURL}${endpoint}`, {
    headers: getAuthHeaders(token),
  });
};

module.exports = {
  GITHUB_API_CONFIG,
  getAuthHeaders,
  fetchGithubData,
};
