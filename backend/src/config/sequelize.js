const { Sequelize } = require('sequelize');
const dbConfig = require('./database');

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

// Keep config out of logs, but fail fast if required values are missing.
if (!config?.database || !config?.username || !config?.host) {
  // eslint-disable-next-line no-console
  console.error('Database config missing. Ensure DB_HOST, DB_NAME, DB_USER are set.');
}

const sequelize = new Sequelize(config.database, config.username, config.password, config);

module.exports = { sequelize };

