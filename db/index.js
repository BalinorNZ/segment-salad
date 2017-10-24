const { Pool } = require('pg');

// Setup Postgres connection
const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  database: 'cambridge',
});

module.exports = {
  query: (text, params) => pool.query(text, params)
};