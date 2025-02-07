// Example helper function
exports.formatResponse = (data) => {
  return {
    success: true,
    data: data,
    timestamp: new Date(),
  };
};
