const express = require('express');
const router = express.Router();
const https = require("https");
const fetch = require("node-fetch");
const db = require("../db");
const pgp = require('pg-promise')();

// Strava API key
const strava_access_token = '1e0c15bfece72d30bdc7fac56e3a90fae34508e8';
const strava_headers = { headers: {
  Authorization: `Bearer ${strava_access_token}`,
  "Content-Type": "application/x-www-form-urlencoded"
}};

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
router.get('/segments/:id/leaderboard', async (req, res) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/segments/${req.params.id}/leaderboard`,
      strava_headers
    );
    const leaderboard = await response.json();
    res.send(leaderboard);
  } catch (err) {
    console.log(err);
  }
});

router.get('/segments/explore/:a_lat/:a_long/:b_lat/:b_long', async (req, res) => {
  try {
    const { a_lat, a_long, b_lat, b_long } = req.params;
    const response = await fetch(
      `https://www.strava.com/api/v3/segments/explore?bounds=
      ${a_lat},${a_long},${b_lat},${b_long}&activity_type=running`,
      strava_headers
    );
    const segments = await response.json();

    // Insert these segments into segment table
    const ColSet = new pgp.helpers.ColumnSet(['id', 'name', 'climb_category', 'climb_category_desc', 'avg_grade',
      'elev_difference', 'distance', 'points', 'start_latlng', 'end_latlng'],
      { table: 'segments' });
    const segment_data = segments.segments.map(s => Object.assign(
        {},
        s,
        { start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
          end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})` }
      ));
    const insert = pgp.helpers.insert(segment_data, ColSet);
    await db.query(insert);

    // Insert this rectangle into rectangles table to check if it's been explored
    const query = 'INSERT INTO rectangles(start_latlng, end_latlng) VALUES($1, $2)';
    const points = [
      `(${a_lat},${a_long})`,
      `(${b_lat},${b_long})`,
    ];
    await db.query(query, points);
    res.send(segments);
  } catch (err) {
    console.log(err);
  }
});
/*
* TODO: move pg promise config from top of file to db\index.js
* TODO: refactor getDunedinSegments, getCRs, getSegments from client to server
* TODO: add created/modified date rectangles, segments, efforts tables
*  - when segments are queried for a rectangle, query all the rectangles contained to see if they are up to date
*  - run segment/explore API call for any unexplored rectangles
*
* Use GraphQL to query everything
* Could handle pagination on the back end, sync data to the database or used cached database instead of API call
*
* */


/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
