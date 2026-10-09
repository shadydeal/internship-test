const mongoose = require('mongoose');
const { createApp } = require('./app');
const { getConfig } = require('./config');

async function start() {
  const config = getConfig();
  await mongoose.connect(config.mongoUri);

  const server = createApp({ jwtSecret: config.jwtSecret, jwtExpiresIn: config.jwtExpiresIn }).listen(config.port, () => {
    console.log(`Grocery Store API listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Failed to start the API:', error);
  process.exitCode = 1;
});
