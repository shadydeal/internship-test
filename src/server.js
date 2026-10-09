// Load Mongoose so the server can establish and close the database connection.
const mongoose = require('mongoose');
// Load the HTTP app factory independently from server startup.
const { createApp } = require('./app');
// Load and validate runtime configuration.
const { getConfig } = require('./config');

/** Connect to MongoDB and start the HTTP server using validated configuration. */
async function start() {
  // Read configuration only when starting the executable server.
  const config = getConfig();
  // Ensure the database is reachable before accepting HTTP requests.
  await mongoose.connect(config.mongoUri);

  // Log the bound port after the HTTP listener is ready.
  const server = createApp({ jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn }).listen(config.port, () => {
    console.log(`Grocery Store API listening on port ${config.port}`);
  });

  /** Stop accepting requests, close MongoDB, and exit cleanly on a process signal. */
  const shutdown = async () => {
    // Finish active requests before closing the database connection.
    server.close(async () => {
      // Release the database connection after the HTTP listener closes.
      await mongoose.disconnect();
      // Exit successfully after completing graceful shutdown.
      process.exit(0);
    });
  };
  // Gracefully shut down on a Ctrl+C interrupt.
  process.once('SIGINT', shutdown);
  // Gracefully shut down when the process receives a termination signal.
  process.once('SIGTERM', shutdown);
}

// Report startup failures and leave a failing process exit code for supervisors.
start().catch((error) => {
  // Write the original startup error to stderr for diagnostics.
  console.error('Failed to start the API:', error);
  // Signal failure to the operating system without masking the startup error.
  process.exitCode = 1;
});
