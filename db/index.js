const pgp = require('pg-promise')();

// Setup Postgres connection
const db = pgp({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  database: 'cambridge',
});

module.exports = db;