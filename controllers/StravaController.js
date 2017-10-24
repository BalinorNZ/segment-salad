/**
 * Strava Controller
 */
const fetch = require("node-fetch");
const db = require("../db");
const pgp = require('pg-promise')();

// Strava API key
const strava_access_token = '1e0c15bfece72d30bdc7fac56e3a90fae34508e8';
const strava_headers = { headers: {
  Authorization: `Bearer ${strava_access_token}`,
  "Content-Type": "application/x-www-form-urlencoded"
}};

module.exports = {

  activities: async (page) => {
    try {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=50`,
        strava_headers
      );
      return await response.json();
    } catch (err) {
      console.log(err);
    }
  },

  athleteStats: async (id) => {
    try {
      const response = await fetch(
        `https://www.strava.com/api/v3/athletes/${id}/stats`,
        strava_headers
      );
      return await response.json();
    } catch (err) {
      console.log(err);
    }
  },

  athleteZones: async () => {
    try {
      const response = await fetch(
        `https://www.strava.com/api/v3/athlete/zones`,
        strava_headers
      );
      return await response.json();
    } catch (err) {
      console.log(err);
    }
  },

  segmentLeaderboard: async (id) => {
    try {
      const response = await fetch(
        `https://www.strava.com/api/v3/segments/${id}/leaderboard`,
        strava_headers
      );
      return await response.json();
    } catch (err) {
      console.log(err);
    }
  },

/*
* TODO: add created/modified date rectangles, segments, efforts tables
*  - when segments are queried for a rectangle, query all the rectangles contained to see if they are up to date
*  - run segment/explore API call for any unexplored rectangles
*  - Use GraphQL to query everything
*  - Could handle pagination on the back end, sync data to the database or used cached database instead of API call
* */
  segmentsExplore: async (rect_coords) => {
    let segments = [];

    try {
      const db_rects = await db.query('SELECT * from rectangles');
      const db_segments = await db.query('SELECT * from segments');

      const sub_rects = getSubRects(rect_coords, 6);
      sub_rects.forEach(async rect => {
        // TODO if(rectAlreadyCached(rect)) return; ### Check if this rect has already been scanned
        segments.push(await getSegments(rect[0], rect[1], rect[2], rect[3]));
        // Insert this rectangle into rectangles table to check if it's been explored
        const query = 'INSERT INTO rectangles(start_latlng, end_latlng) VALUES($1, $2)';
        const points = [
          `(${rect[0]},${rect[1]})`,
          `(${rect[2]},${rect[3]})`,
        ];
        await db.query(query, points);
      });

      let new_segments = [];
      segments.forEach(segment => {
        // (TODO CHECK FOR DUPES) const dupes = payload.segments.filter(s => this.state.segments.includes(s.id));
        // if(segmentAlreadyCached(segment)) return; ### Check if this segment has already been cached
        //this.getCRs(payload.segments);
        new_segments.push(segment);
      });

      // Insert these segments into segment table
      if(new_segments.length) {
        const ColSet = new pgp.helpers.ColumnSet(['id', 'name', 'climb_category', 'climb_category_desc',
            'avg_grade', 'elev_difference', 'distance', 'points', 'start_latlng', 'end_latlng'],
          {table: 'segments'});
        const segment_data = new_segments.map(s => Object.assign(
          {},
          s,
          {
            start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
            end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`
          }
        ));
        const insert = pgp.helpers.insert(segment_data, ColSet);
        await db.query(insert);
      }

      // get leaderboards for new segments
      const new_segments_with_cr = new_segments.map(async s => {
        const response = await fetch(
          `https://www.strava.com/api/v3/segments/${s.id}/leaderboard`,
          strava_headers
        );
        const leaderboard = await response.json();
        // TODO: write leaderboard efforts to db
        return Object.assign({}, s, { cr: leaderboard.entries[0], entry_count: leaderboard.entry_count });
      });

      return [...new_segments_with_cr, ...db_segments];
    } catch (err) {
      console.log(err);
    }

  },
};

const getSegments = async (a_lat, a_long, b_lat, b_long) => {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/segments/explore?bounds=${a_lat},${a_long},${b_lat},${b_long}&activity_type=running`,
      strava_headers
    );
    const payload = await response.json();
    return payload.segments;
  } catch (err) {
    console.log(err);
  }
};

const getSubRects = (rect_coords, splits) => {
  const { minlat, minlong, maxlat, maxlong } = rect_coords;
  const longpoints = [];
  const latpoints = [];
  const sub_rects = [];

  for(let i=0; i <= splits; i++){
    latpoints.push((minlat + ((maxlat-minlat)/splits)*i));
    longpoints.push((minlong + ((maxlong-minlong)/splits)*i));
  }

  //Now loop through and create a list of sub-rectangles
  latpoints.map((latmin, latindex) => {
    longpoints.map((longmin, longindex) => {
      if(latindex < (latpoints.length-1) && longindex < (longpoints.length-1)){
        sub_rects.push([latmin, longmin, latpoints[latindex+1], longpoints[longindex+1]]);
      }
    })
  });

  return sub_rects;
};