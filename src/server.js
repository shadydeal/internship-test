const mongoose = require('mongoose');
const { createApp } = require('./app');
const { getConfig } = require('./config');

/** Connect to MongoDB and start the HTTP server using validated configuration. */
async function start() {
  const config = getConfig();
  await mongoose.connect(config.mongoUri);

  // Log the bound port after the HTTP listener is ready.
  const server = createApp({ jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn }).listen(config.port, () => {
    console.log(`Grocery Store API listening on port ${config.port}`);
  });

  /** Stop accepting requests, close MongoDB, and exit cleanly on a process signal. */
  const shutdown = async () => {
    // Finish active requests before closing the database connection.
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

// Report startup failures and leave a failing process exit code for supervisors.
start().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exitCode = 1;
});
