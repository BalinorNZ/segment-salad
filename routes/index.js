const express = require('express');
const router = express.Router();
const https = require("https");
const pg = require("pg");
const fetch = require("node-fetch");

// Strava API key
const strava_access_token = '1e0c15bfece72d30bdc7fac56e3a90fae34508e8';
const strava_headers = { headers: {
  Authorization: `Bearer ${strava_access_token}`,
  "Content-Type": "application/x-www-form-urlencoded"
}};

// Setup Postgres connection
const conn = {
  username: 'postgres',
  password: 'postgres',
  host: 'localhost',
  database: 'cambridge',
};
const conString = `postgres://${conn.username}:${conn.password}@${conn.host}/${conn.database}`;

const coffee_query = "SELECT row_to_json(fc) " +
  "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features " +
  "FROM (SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json((id, name)) As properties " +
  "FROM cambridge_coffee_shops As lg) As f) As fc";

const coffee_shop_query = `SELECT cambridge_neighborhoods.name as name, count(*) 
FROM cambridge_coffee_shops, cambridge_neighborhoods 
WHERE ST_Intersects(cambridge_coffee_shops.geom, cambridge_neighborhoods.geom) 
GROUP BY cambridge_neighborhoods.name`;

router.get('/data', async (req, res, next) => {
  const client = new pg.Client(conString);
  try {
    await client.connect();
    const result = await client.query(coffee_query);
    res.send(result.rows[0].row_to_json);
    await client.end();
  } catch (e) {
    next(e);
  }
});

/*
 * Strava API Requests
 */
router.get('/activities/:page', async (req, res) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?page=${req.params.page}&per_page=50`,
      strava_headers
    );
    const activities = await response.json();
    res.send(activities);
  } catch (err) {
    console.log(err);
  }
});
router.get('/athletes/:id/stats', async (req, res) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athletes/${req.params.id}/stats`,
      strava_headers
    );
    const athlete = await response.json();
    res.send(athlete);
  } catch (err) {
    console.log(err);
  }
});
router.get('/athlete/zones', async (req, res) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/zones`,
      strava_headers
    );
    const zones = await response.json();
    res.send(zones);
  } catch (err) {
    console.log(err);
  }
});

/*
*
* Move all the Strava API requests to get segments, athlete data, efforts etc into here and use GraphQL to query it
* Could handle pagination on the back end, sync data to the database or used cached database instead of API call
*
* */


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
