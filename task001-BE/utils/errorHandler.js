const handleApiError = (error, res, customMessage) => {
  console.error(`Error: ${customMessage}:`, error);
  res.status(500).json({
    error: customMessage,
    details: error.response?.data || error.message,
  });
};

module.exports = {
  handleApiError,
};
