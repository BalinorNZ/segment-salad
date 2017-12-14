/**
 * Strava Manager - handle Strava API requests and Postgres database queries
 */
const fetch = require("node-fetch");
const db = require("../db");
const pgp = require('pg-promise')();
const _ = require('lodash');
const config = require('../data/strava_config');

// Strava API key
const strava_access_token = config.access_token;
const strava_headers = { headers: {
  Authorization: `Bearer ${strava_access_token}`,
  "Content-Type": "application/x-www-form-urlencoded"
}};


async function StravaAPIRequest(url) {
  try {
    const response = await fetch(
      `https://www.strava.com/api/v3/${url}`,
      strava_headers
    );
    return await response.json();
  } catch (err) {
    console.log(err);
  }
}

const authenticate = async () => {
  try {
    const response = await fetch(
      `https://www.strava.com/oauth/authorize`,
      Object.assign({}, strava_headers, {client_id: config.client_id, redirect_uri: 'localhost:3000', response_type: 'code'})
    );
    return await response.json();
  } catch (err) {
    console.log(err);
  }
};

const segmentsExplore = async rect_coords => {
  try {
    const db_rects = await db.query('SELECT * from rectangles');
    const db_segments = await db.query(buildEffortQuery());
    // Include segments that have no efforts against them
    const effortless_segments = await db.query('SELECT * from segments '
      + 'LEFT JOIN segment_efforts ON segments.id = segment_efforts.segment_id '
      + 'WHERE public.segment_efforts.rank IS NULL');

    // TODO: given the starting long/lat, recursively generate sub rects to scan until sub rect size < 1km
    const sub_rects = getSubRects(rect_coords, 1);
    const segments_arrays = await Promise.all(sub_rects.map(async rect => {
      // TODO: if(rectAlreadyCached(rect)) return; ### Check if this rect has already been scanned
      // TODO: Insert this rectangle into rectangles table to check if it's been explored
      const query = 'INSERT INTO rectangles(start_latlng, end_latlng) VALUES($1, $2)';
      const points = [
        `(${rect[0]},${rect[1]})`,
        `(${rect[2]},${rect[3]})`,
      ];
      await db.query(query, points);
      return await getSegments(rect[0], rect[1], rect[2], rect[3]);
    }));

    const segments = [].concat.apply([], segments_arrays);
    if(segments[0] === undefined)
      console.log('Segment undefined, Strava API limit probably reached.');

    const new_segments = (segments[0] === undefined) ? [] :
      segments.filter(segment => {
        return !db_segments.find(s => parseInt(s.id) === parseInt(segment.id));
      });

    console.log('new', new_segments.length, new_segments.map(s => s.id));
    console.log('api', segments.length);
    console.log('db', db_segments.length);
    console.log('rects', sub_rects.length);
    console.log('rect size', sub_rects[0][0], sub_rects[0][1], sub_rects[0][2], sub_rects[0][3]);

    // Insert these segments into segment table
    if(new_segments.length) {
      const ColSet = new pgp.helpers.ColumnSet(['id', 'name', 'climb_category', 'climb_category_desc',
          'avg_grade', 'elev_difference', 'distance', 'points', 'start_latlng', 'end_latlng'],
        {table: 'segments'});
      const segment_data = new_segments.map(s => Object.assign({}, s,
        {
          start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
          end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`
        }
      ));
      const insert = pgp.helpers.insert(segment_data, ColSet);
      await db.query(insert);
    }

    // get leaderboards for new segments
    const new_segments_with_cr = await Promise.all(new_segments.map(async segment => {
      const leaderboard = await updateSegmentLeaderboard(segment.id);
      return Object.assign({}, segment, leaderboard);
    }));

    return [...new_segments_with_cr, ...db_segments, ...effortless_segments];
  } catch (err) {
    console.log(err);
  }
};

const updateSegmentLeaderboard = async segment_id => {
  try {
    // should probably rewrite this without a gross while loop and mutating variables
    let entries = [];
    let entry_count;
    let page = 1;
    while (true) { // while there are pages with segments left
      const leaderboard = await StravaAPIRequest(`segments/${segment_id}/leaderboard?page=${page}&per_page=200`);
      entry_count = leaderboard.entry_count;
      entries = [...entries, ...leaderboard.entries];
      if (entry_count/200 < page) break;
      page ++;
    }

    // Write entry_count to segments table
    await db.query('UPDATE segments SET entry_count = $1 WHERE id = $2', [entry_count, segment_id]);

    // Make a list of leaderboard efforts that aren't already recorded
    const db_efforts = await db.query('SELECT * from segment_efforts WHERE segment_id = $1', [segment_id]);
    const new_effort_ids = _.difference(
      entries.map(e => parseInt(e.effort_id)), db_efforts.map(e => parseInt(e.effort_id))
    );
    const new_efforts = _.uniqBy(entries.filter(entry => new_effort_ids.includes(entry.effort_id)), 'effort_id');

    // Make a list of db leaderboard efforts that no longer exist
    const deleted_effort_ids = _.difference(
      db_efforts.map(e => parseInt(e.effort_id)), entries.map(e => parseInt(e.effort_id))
    );
    if(deleted_effort_ids.length) {
      const markers = deleted_effort_ids.map((id, index) => '$' + (parseInt(index) + 1)).join(', ');
      await db.query('DELETE FROM segment_efforts WHERE effort_id IN (' + markers + ')',
        deleted_effort_ids.map(id => parseInt(id)));
    }

    console.log('UPDATE SEGMENT - segment_id:', segment_id,
      ', response_entries:', entries.length,
      ', db_efforts:', db_efforts.length,
      ', new efforts:', new_efforts.length,
      ', deleted efforts:', deleted_effort_ids.length);

    // Insert leaderboard efforts that aren't already recorded into segment_efforts table
    if(new_efforts.length) {
      const efforts_data = new_efforts
        .map(effort => Object.assign({}, effort, { segment_id }));
      const segment_effort_col_set = new pgp.helpers.ColumnSet(['athlete_id', 'effort_id', 'activity_id', 'segment_id',
          'rank', 'athlete_name', 'athlete_gender', 'average_hr', 'average_watts', 'distance', 'elapsed_time',
          'moving_time', 'start_date', 'start_date_local', 'athlete_profile'],
        {table: 'segment_efforts'});
      const insert = pgp.helpers.insert(efforts_data, segment_effort_col_set);
      await db.query(insert);
    }

    return Object.assign({}, entries[0], { entry_count });

  } catch (err) {
    console.log(err);
  }
};

const buildEffortQuery = (column, value) => {
  let where_clause = '';
  if(column && value) {
    where_clause = `WHERE ${column} = ${value} `;
    if(Array.isArray(value)) where_clause = `WHERE ${column} in (${value.join(',')}) `;
    console.log(where_clause);
  }
  return 'select * from segments '
    + 'join (select distinct on (segment_id) '
    + 'athlete_id, effort_id, activity_id, segment_id, athlete_name, athlete_gender, distance as effort_distance, '
    + 'elapsed_time, moving_time, start_date, start_date_local, athlete_profile, modified as effort_modified, '
    + 'created as effort_created '
    + 'from segment_efforts '
    + where_clause
    + 'order by segment_id, elapsed_time, start_date desc '
    + ') as course_record on segments.id = course_record.segment_id';
};

const getSegments = async (a_lat, a_long, b_lat, b_long) => {
  const payload =
    await StravaAPIRequest(`segments/explore?bounds=${a_lat},${a_long},${b_lat},${b_long}&activity_type=running`);
  return payload.segments;
};

const getSubRects = (rect_coords, splits) => {
  const minlat = parseFloat(rect_coords.a_lat);
  const minlong = parseFloat(rect_coords.a_long);
  const maxlat = parseFloat(rect_coords.b_lat);
  const maxlong = parseFloat(rect_coords.b_long);
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

// gets segment data for all an athlete's activities
// currently not working due to lack of geo data in strava API response
const scanAllActivitiesForNewSegments = async page => {
  try {
    const db_segments = await db.query(buildEffortQuery());
    const activities = await StravaAPIRequest(`athlete/activities?page=${page}&per_page=200`);
    // Slice activities to first 500 to avoid hitting Strava API rate limit.
    await Promise.all(activities.slice(0, 500).map(async activity => {
      const full_activity = await StravaAPIRequest(`activities/${activity.id}?include_all_efforts=true`);

      if(full_activity.segment_efforts[0] === undefined) return;

      const new_segments = full_activity.segment_efforts.filter(effort => {
        return !db_segments.find(s => parseInt(s.id) === parseInt(effort.segment.id))
      });
      await Promise.all(new_segments.map(async effort => {
        if(effort.segment.private) return;

        // save effort.segment to db
        const full_segment = await StravaAPIRequest(`segments/${effort.segment.id}`);
        console.log(`Saving new segment ${full_segment.name}`, 'from activity', activity.id);
        const ColSet = new pgp.helpers.ColumnSet(['id', 'name', 'climb_category',
            'avg_grade', 'distance', 'points', 'start_latlng', 'end_latlng'],
          {table: 'segments'});
        const segment_data = [effort.segment].map(s => Object.assign({}, s,
          {
            avg_grade: s.average_grade,
            start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
            end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`,
            points: full_segment.map.polyline,
          }
        ));
        const insert_segment = pgp.helpers.insert(segment_data, ColSet);
        await db.query(insert_segment);

        // save efforts for new segment to db
        await updateSegmentLeaderboard(full_segment.id);
      }));
    }));
    return activities;
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  StravaAPIRequest,
  authenticate,
  segmentsExplore,
  updateSegmentLeaderboard,
  updateEffortsForAllSegments,
  buildEffortQuery,
  scanAllActivitiesForNewSegments,
};



/*
 * Currently unused
 */
// Temporary function to add missing athlete IDs to efforts table
async function updateEffortsForAllSegments() {
  console.log("updateEffortsForAllSegments starting");
  const segments = await db.query("SELECT id FROM segments");
  if(segments.length) {
    await Promise.all(segments.slice(0, 10).map(async segment => {
      if(!segment.id) return;
      try {
        let entries = [];
        let entry_count;
        let page = 1;
        while (true) { // while there are still pages with segments
          const leaderboard = await StravaAPIRequest(`segments/${segment.id}/leaderboard?page=${page}&per_page=200`);
          entry_count = leaderboard.entry_count;
          entries = [...entries, ...leaderboard.entries];
          if (entry_count/200 < page) break;
          page ++;
        }
        // Make a list of leaderboard efforts that aren't already recorded
        const db_efforts = await db.query('SELECT * from segment_efforts WHERE segment_id = $1', [segment.id]);
        const new_effort_ids = _.difference(
          entries.map(e => parseInt(e.effort_id)), db_efforts.map(e => parseInt(e.effort_id))
        );
        // Update existing efforts
        const existing_effort_ids = _.difference(
          entries.map(e => parseInt(e.effort_id)), new_effort_ids
        );
        const existing_efforts = _.uniqBy(entries.filter(effort => existing_effort_ids.includes(effort.effort_id)), 'effort_id');
        console.log("updating efforts", existing_efforts.length, segment.id);
        await Promise.all(existing_efforts.map(async effort => {
          await db.query('UPDATE segment_efforts SET athlete_id = $1 WHERE effort_id = $2', [effort.athlete_id, effort.effort_id]);
        }));
      } catch (err) {
        console.log('updateEffortsForAllSegments caught', err);
      }
    })).catch(err => console.log(err));
  }
};