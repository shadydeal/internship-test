require('dotenv').config();

/** Load and validate the environment-backed settings required by the API. */
function getConfig() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  return {
    port: Number(process.env.PORT || 3000),
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grocery_store',
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  };
}

module.exports = { getConfig };
