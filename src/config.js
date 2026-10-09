// Load local environment variables from .env when the file exists.
require('dotenv').config();

/** Load and validate each environment-backed setting required by the API. */
function getConfig() {
  // Read the signing key once so validation and returned configuration use the same value.
  const jwtSecret = process.env.JWT_SECRET;
  // Reject missing or weak keys instead of starting with insecure token signing.
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to at least 32 characters.');
  }

  // Return the HTTP port, MongoDB connection, token key, and token lifetime.
  return {
    port: Number(process.env.PORT || 3000), // Use the configured port or the local development default.
    mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/grocery_store', // Connect to the configured database or local MongoDB.
    jwtSecret, // Keep the validated signing secret available to authentication code.
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h', // Limit how long issued access tokens remain valid.
  };
}

// Export the loader for both the server and app configuration.
module.exports = { getConfig };
