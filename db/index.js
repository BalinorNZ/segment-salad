const pgp = require('pg-promise')();

// Setup Postgres connection
const db = pgp({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: '5432',
  database: 'segmentsalad',
});

module.exports = db;