/**
 * Strava Manager - handle Strava API requests and Postgres database queries
 */
const fetch = require("node-fetch");
const db = require("../db");
const pgp = require("pg-promise")();
const _ = require("lodash");
const config = require("../data/strava_config");

// Strava API key
const strava_access_token = config.access_token;
const strava_headers = {
  headers: {
    Authorization: `Bearer ${strava_access_token}`,
    "Content-Type": "application/x-www-form-urlencoded"
  }
};

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
      Object.assign({}, strava_headers, {
        client_id: config.client_id,
        redirect_uri: "localhost:3000",
        response_type: "code"
      })
    );
    return await response.json();
  } catch (err) {
    console.log(err);
  }
};

const getSegments = async () => {
  const db_segments = await db.query(buildEffortQuery());
  const effortless_segments = await getEffortlessSegments();
  return [...db_segments, ...effortless_segments];
};

const getActivities = async () => {
  return await db.query("SELECT * from activities");
};

const getEffortlessSegments = async () => {
  return await db.query(
    "SELECT * from segments " +
      "LEFT JOIN segment_efforts ON segments.id = segment_efforts.segment_id " +
      "WHERE public.segment_efforts.rank IS NULL"
  );
};

const segmentsExplore = async rect_coords => {
  try {
    const db_rects = await db.query("SELECT * from rectangles");
    const db_segments = await getSegments();

    // TODO: given the starting long/lat, recursively generate sub rects to scan until sub rect size < 1km
    const sub_rects = getSubRects(rect_coords, 1);
    const segments_arrays = await Promise.all(
      sub_rects.map(async rect => {
        // TODO: if(rectAlreadyCached(rect)) return; ### Check if this rect has already been scanned
        // TODO: Insert this rectangle into rectangles table to check if it's been explored
        const query =
          "INSERT INTO rectangles(start_latlng, end_latlng) VALUES($1, $2)";
        const points = [`(${rect[0]},${rect[1]})`, `(${rect[2]},${rect[3]})`];
        await db.query(query, points);
        const payload = await StravaAPIRequest(
          `segments/explore?bounds=${rect[0]},${rect[1]},${rect[2]},${
            rect[3]
          }&activity_type=running`
        );
        return payload.segments;
      })
    );

    const segments = [].concat.apply([], segments_arrays);
    if (segments[0] === undefined)
      console.log("Segment undefined, Strava API limit probably reached.");

    const new_segments =
      segments[0] === undefined
        ? []
        : segments.filter(segment => {
            return !db_segments.find(
              s => parseInt(s.id) === parseInt(segment.id)
            );
          });

    console.log("new", new_segments.length, new_segments.map(s => s.id));
    console.log("api", segments.length);
    console.log("db", db_segments.length);
    console.log("rects", sub_rects.length);
    console.log(
      "rect size",
      sub_rects[0][0],
      sub_rects[0][1],
      sub_rects[0][2],
      sub_rects[0][3]
    );

    // Insert these segments into segment table
    if (new_segments.length) {
      const ColSet = new pgp.helpers.ColumnSet(
        [
          "id",
          "name",
          "climb_category",
          "climb_category_desc",
          "avg_grade",
          "elev_difference",
          "distance",
          "points",
          "start_latlng",
          "end_latlng"
        ],
        { table: "segments" }
      );
      const segment_data = new_segments.map(s =>
        Object.assign({}, s, {
          start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
          end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`
        })
      );
      const insert = pgp.helpers.insert(segment_data, ColSet);
      await db.query(insert);
    }

    // get leaderboards for new segments
    const new_segments_with_cr = await Promise.all(
      new_segments.map(async segment => {
        const leaderboard = await updateSegmentLeaderboard(segment.id);
        return Object.assign({}, segment, leaderboard);
      })
    );

    return [...new_segments_with_cr, ...db_segments];
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
    while (true) {
      // while there are pages with segments left
      const leaderboard = await StravaAPIRequest(
        `segments/${segment_id}/leaderboard?page=${page}&per_page=200`
      );
      entry_count = leaderboard.entry_count;
      entries = [...entries, ...leaderboard.entries];
      if (entry_count / 200 < page) break;
      page++;
    }

    // Write entry_count to segments table
    await db.query("UPDATE segments SET entry_count = $1 WHERE id = $2", [
      entry_count,
      segment_id
    ]);

    // Make a list of leaderboard efforts that aren't already recorded
    const db_efforts = await db.query(
      "SELECT * from segment_efforts WHERE segment_id = $1",
      [segment_id]
    );
    const new_effort_ids = _.difference(
      entries.map(e => parseInt(e.effort_id)),
      db_efforts.map(e => parseInt(e.effort_id))
    );
    const new_efforts = _.uniqBy(
      entries.filter(entry => new_effort_ids.includes(entry.effort_id)),
      "effort_id"
    );

    // Make a list of db leaderboard efforts that no longer exist
    const deleted_effort_ids = _.difference(
      db_efforts.map(e => parseInt(e.effort_id)),
      entries.map(e => parseInt(e.effort_id))
    );
    console.log("entries", entries);
    console.log("db_efforts", db_efforts);
    if (deleted_effort_ids.length) {
      const markers = deleted_effort_ids
        .map((id, index) => "$" + (parseInt(index) + 1))
        .join(", ");
      // await db.query('DELETE FROM segment_efforts WHERE effort_id IN (' + markers + ')',
      //   deleted_effort_ids.map(id => parseInt(id)));
    }

    console.log(
      "UPDATE SEGMENT - segment_id:",
      segment_id,
      ", response_entries:",
      entries.length,
      ", db_efforts:",
      db_efforts.length,
      ", new efforts:",
      new_efforts.length,
      ", deleted efforts:",
      deleted_effort_ids.length
    );

    // Insert leaderboard efforts that aren't already recorded into segment_efforts table
    if (new_efforts.length) {
      const efforts_data = new_efforts.map(effort =>
        Object.assign({}, effort, { segment_id })
      );
      const segment_effort_col_set = new pgp.helpers.ColumnSet(
        [
          "athlete_id",
          "effort_id",
          "activity_id",
          "segment_id",
          "rank",
          "athlete_name",
          "athlete_gender",
          "average_hr",
          "average_watts",
          "distance",
          "elapsed_time",
          "moving_time",
          "start_date",
          "start_date_local",
          "athlete_profile"
        ],
        { table: "segment_efforts" }
      );
      const insert = pgp.helpers.insert(efforts_data, segment_effort_col_set);
      await db.query(insert);
    }

    return Object.assign({}, entries[0], { entry_count });
  } catch (err) {
    console.log(err);
  }
};

const buildEffortQuery = (column, value) => {
  let where_clause = "";
  if (column && value) {
    where_clause = `WHERE ${column} = ${value} `;
    if (Array.isArray(value))
      where_clause = `WHERE ${column} in (${value.join(",")}) `;
    console.log(where_clause);
  }
  return (
    "select * from segments " +
    "join (select distinct on (segment_id) " +
    "athlete_id, effort_id, activity_id, segment_id, athlete_name, athlete_gender, distance as effort_distance, " +
    "elapsed_time, moving_time, start_date, start_date_local, athlete_profile, modified as effort_modified, " +
    "created as effort_created " +
    "from segment_efforts " +
    where_clause +
    "order by segment_id, elapsed_time, start_date desc " +
    ") as course_record on segments.id = course_record.segment_id"
  );
};

const getSubRects = (rect_coords, splits) => {
  const minlat = parseFloat(rect_coords.a_lat);
  const minlong = parseFloat(rect_coords.a_long);
  const maxlat = parseFloat(rect_coords.b_lat);
  const maxlong = parseFloat(rect_coords.b_long);
  const longpoints = [];
  const latpoints = [];
  const sub_rects = [];

  for (let i = 0; i <= splits; i++) {
    latpoints.push(minlat + (maxlat - minlat) / splits * i);
    longpoints.push(minlong + (maxlong - minlong) / splits * i);
  }

  //Now loop through and create a list of sub-rectangles
  latpoints.map((latmin, latindex) => {
    longpoints.map((longmin, longindex) => {
      if (
        latindex < latpoints.length - 1 &&
        longindex < longpoints.length - 1
      ) {
        sub_rects.push([
          latmin,
          longmin,
          latpoints[latindex + 1],
          longpoints[longindex + 1]
        ]);
      }
    });
  });

  return sub_rects;
};

// gets segment data for all an athlete's activities
const scanAllActivitiesForNewSegments = async athlete_id => {
  try {
    console.log("scanAllActivitiesForNewSegments");
    const db_segments = await getSegments();
    const athlete_stats = await StravaAPIRequest(
      `/athletes/${athlete_id}/stats`
    );
    const activity_count =
      athlete_stats.all_ride_totals.count +
      athlete_stats.all_run_totals.count +
      athlete_stats.all_swim_totals.count;
    // should probably rewrite this without a gross while loop and mutating variables
    let all_activities = [];
    let page = 1;
    const per_page = 200;
    while (Math.ceil(activity_count / per_page) >= page) {
      // while there are pages with activities left
      const activities_page = await StravaAPIRequest(
        `athlete/activities?page=${page}&per_page=${per_page}`
      );
      all_activities = [...all_activities, ...activities_page];
      page++;
    }
    const activities = all_activities.filter(a => a.type === "Run");
    const activity_segment_efforts = await Promise.all(
      activities.slice(0, 10).map(async activity => {
        // Get full activity from Strava (which has segment efforts)
        const full_activity = await StravaAPIRequest(
          `activities/${activity.id}?include_all_efforts=true`
        );
        console.log(full_activity);
        // TODO: save full activity to db
        // const ColSet = new pgp.helpers.ColumnSet(['id', 'name', 'climb_category',
        //     'avg_grade', 'distance', 'points', 'start_latlng', 'end_latlng'],
        //   {table: 'segments'});
        // const segment_data = [segment].map(s => Object.assign({}, s,
        //   {
        //     avg_grade: s.average_grade,
        //     start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
        //     end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`,
        //     points: full_segment.map.polyline,
        //   }
        // ));
        // const insert_segment = pgp.helpers.insert(segment_data, ColSet);
        // await db.query(insert_segment);

        return full_activity.segment_efforts;
      })
    );
    const segment_efforts = _.flatten(activity_segment_efforts);

    const new_segments = _.uniqBy(
      segment_efforts
        .filter(
          effort =>
            !db_segments.find(
              db_segment =>
                parseInt(db_segment.id) === parseInt(effort.segment.id)
            )
        )
        .filter(
          effort => !effort.segment.private // don't save athlete's private segments
        )
        .map(effort => effort.segment),
      "segment_id"
    );

    console.log(
      `Found ${new_segments.length} new segments in ${
        segment_efforts.length
      } efforts from ${activities.length} activities.`
    );

    await Promise.all(
      new_segments.map(async segment => {
        // Get full segment data from Strava (which has polyline data)
        const full_segment = await StravaAPIRequest(`segments/${segment.id}`);
        console.log(
          `Saving new segment ${full_segment.name}(${full_segment.id})`
        );
        // save segment to db
        const ColSet = new pgp.helpers.ColumnSet(
          [
            "id",
            "name",
            "climb_category",
            "avg_grade",
            "distance",
            "points",
            "start_latlng",
            "end_latlng"
          ],
          { table: "segments" }
        );
        const segment_data = [segment].map(s =>
          Object.assign({}, s, {
            avg_grade: s.average_grade,
            start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
            end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`,
            points: full_segment.map.polyline
          })
        );
        const insert_segment = pgp.helpers.insert(segment_data, ColSet);
        await db.query(insert_segment);

        // save efforts for new segment to db
        // TODO: removed for now since getting all efforts for segments doesn't work anymore
        //await updateSegmentLeaderboard(full_segment.id);
      })
    );
    return activities;
  } catch (err) {
    console.log(err);
  }
};

const getAthletes = async () => {
  return await db.query(
    "SELECT DISTINCT on (athlete_id) " +
      "athlete_id, athlete_name, athlete_profile, effort_id " +
      "FROM segment_efforts ORDER BY athlete_id, effort_id DESC;"
  );
};




const getAthleteSegments = async () => {
  try {
    const athlete = await StravaAPIRequest(`athlete`);

    // 1. get activities list
    // let all_activities = [];
    // let page = 1;
    // const per_page = 200;
    // while (Math.ceil(activity_count / per_page) >= page) { // while there are pages with activities left
    //   const activities_page = await StravaAPIRequest(`athlete/activities?page=${page}&per_page=${per_page}`);
    //   all_activities = [...all_activities, ...activities_page];
    //   page++;
    // }
    const activities_page = await StravaAPIRequest(
      `athlete/activities?page=2&per_page=100`
    );
    const activities = activities_page.filter(a => a.type === "Run");
    const db_segment_efforts = await db.query(
      "SELECT effort_id from segment_efforts"
    );
    const db_segments = await db.query("SELECT id from segments");
    // 1.1 filter out activities that already exist in db
    const db_activities = await db.query("SELECT id from activities");
    const new_activities = activities.filter(
      activity =>
        !db_activities.find(
          db_activity => parseInt(db_activity.id) === parseInt(activity.id)
        )
    );

    // 2. save new activities
    await Promise.all(
      new_activities.map(async activity => {
        // get full activty data from Strava
        const full_activity = await StravaAPIRequest(
          `activities/${activity.id}?include_all_efforts=true`
        );
        const ColSet = new pgp.helpers.ColumnSet(
          [
            "id",
            "athlete_id" /*--athlete.id*/,
            "activity_name" /*--name*/,
            "distance",
            "moving_time",
            "elapsed_time",
            "average_speed",
            "max_speed",
            "average_cadence",
            "has_heartrate",
            "average_heartrate",
            "max_heartrate",
            "heartrate_opt_out",
            "calories",
            "elev_high",
            "elev_low",
            "pr_count",
            "description",
            "total_elevation_gain",
            "activity_type" /*type*/,
            "workout_type",
            "external_id",
            "upload_id",
            "start_date",
            "start_date_local",
            "utc_offset",
            "start_latlng",
            "end_latlng",
            "location_city",
            "location_state",
            "location_country",
            "start_latitude",
            "start_longitude",
            "achievement_count",
            "kudos_count",
            "comment_count",
            "athlete_count",
            "photo_count",
            "total_photo_count",
            "full_polyline" /*--map.polyline*/,
            "summary_polyline" /*--map.summary_polyline*/,
            "commute",
            "manual",
            "private",
            "visibility",
            "flagged",
            "gear_id",
            "gear_name" /*--gear.name*/,
            "device_name",
            "laps" /*--JSON.stringify(laps)*/,
            "splits_metric" /*--JSON.stringify(splits_metric)*/,
            "splits_imperial" /*--JSON.stringify(splits_standard)*/
          ],
          { table: "activities" }
        );
        const activity_data = [full_activity].map(a =>
          Object.assign({}, a, {
            athlete_id: full_activity.athlete.id,
            activity_type: full_activity.type,
            activity_name: full_activity.name,
            start_latlng: `(${a.start_latlng[0]},${a.start_latlng[1]})`,
            end_latlng: `(${a.end_latlng[0]},${a.end_latlng[1]})`,
            full_polyline: full_activity.map.polyline,
            summary_polyline: full_activity.map.summary_polyline,
            laps: JSON.stringify(full_activity.laps),
            splits_metric: JSON.stringify(full_activity.splits_metric),
            splits_imperial: JSON.stringify(full_activity.splits_standard),
            gear_name: full_activity.gear.name,
            average_cadence: a.average_cadence || null,
            average_heartrate: a.average_heartrate || null,
            max_heartrate: a.max_heartrate || null,
            device_name: a.device_name || null
          })
        );
        console.log(
          `Saving new activity ${full_activity.name}(${full_activity.id})`
        );
        const insert_activity = pgp.helpers.insert(activity_data, ColSet);
        await db.query(insert_activity);

        // 2.2 filter out segment efforts that already exist in db
        const new_segment_efforts = full_activity.segment_efforts.filter(
          segment_effort =>
            !db_segment_efforts.find(
              db_segment_effort =>
                parseInt(db_segment_effort.effort_id) === parseInt(segment_effort.id)
            )
        );
        console.log(
          "New segment efforts to save: " + new_segment_efforts.length,
          full_activity.segment_efforts.length
        );
        // 2.3 save new segment efforts
        await Promise.all(
          new_segment_efforts.map(async effort => {
            // TODO: add pr_rank field?
            const ColSet = new pgp.helpers.ColumnSet(
              [
                "athlete_id",
                "effort_id",
                "activity_id",
                "segment_id",
                "rank",
                "athlete_name",
                "athlete_gender",
                "average_hr",
                "distance",
                "elapsed_time",
                "moving_time",
                "start_date",
                "start_date_local",
                "athlete_profile"
              ],
              { table: "segment_efforts" }
            );
            const effort_data = [effort].map(e =>
              Object.assign({}, e, {
                effort_id: e.id,
                activity_id: e.activity.id,
                segment_id: e.segment.id,
                athlete_id: e.athlete.id,
                rank: e.kom_rank,
                average_hr: e.average_heartrate,
                athlete_gender: athlete.sex,
                athlete_name: `${athlete.firstname} ${athlete.lastname}`,
                athlete_profile: athlete.profile
              })
            );
            console.log(
              `Saving new segment_effort ${effort.id}(${effort.athlete_name})`
            );

            const insert_segment_effort = pgp.helpers.insert(
              effort_data,
              ColSet
            );
            await db.query(insert_segment_effort);
          })
        );

        // 3. filter out segments that already exist in db
        const new_segments = _.uniqBy(full_activity.segment_efforts.map(e => e.segment).filter(
          segment =>
            !db_segments.find(
              db_segment =>
                parseInt(db_segment.id) === parseInt(segment.id)
            )
        ),
          "id"
        );

        // 3.2 save new segments
        await Promise.all(
          new_segments.filter(segment => segment.private === false).map(async segment => {
            const full_segment = await StravaAPIRequest(`segments/${segment.id}`);
            console.log(`Saving new segment ${full_segment.name}(${full_segment.id}) from activity ${full_activity.name}`);
            const ColSet = new pgp.helpers.ColumnSet(
              [
                "id",
                "name",
                "climb_category",
                "avg_grade",
                "elev_difference",
                "distance",
                "points",
                "start_latlng",
                "end_latlng",
                "entry_count"
              ],
              { table: "segments" }
            );
            const segment_data = [full_segment].map(s => Object.assign({}, s, {
              avg_grade: s.average_grade,
              elev_difference: s.total_elevation_gain, // this might be different to elev_difference taken from leaderboard
              points: s.map.polyline,
              start_latlng: `(${s.start_latlng[0]},${s.start_latlng[1]})`,
              end_latlng: `(${s.end_latlng[0]},${s.end_latlng[1]})`,
              entry_count: s.effort_count,
              // TODO: add to db - maximum_grade, elevation_high, elevation_low, city, state, country, private,
              //  hazardous, created_at, updated_at, athlete_count, star_count, athlete_segment_stats?
              // TODO: write another maintenance function to update these details for existing segments.
            }));
            const insert_segment = pgp.helpers.insert(segment_data, ColSet);
            await db.query(insert_segment);
            db_segments.push({ id: full_segment.id });
          })
        );
      })
    );

    // 4. Display a list of most recent segment efforts.
    // TODO: replace this API call with a DB request (limit 100)
    const activity_segment_efforts = await Promise.all(
      activities.map(async activity => {
        // Get full activity from Strava (which has segment efforts)
        const full_activity = await StravaAPIRequest(
          `activities/${activity.id}?include_all_efforts=true`
        );
        return full_activity.segment_efforts;
      })
    );
    return _.flatten(activity_segment_efforts);
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  StravaAPIRequest,
  authenticate,
  getSegments,
  getAthletes,
  getActivities,
  getEffortlessSegments,
  segmentsExplore,
  updateSegmentLeaderboard,
  updateEffortsForAllSegments,
  buildEffortQuery,
  scanAllActivitiesForNewSegments,
  getAthleteSegments
};





function saveActivity() {

}












/*
 * Currently unused
 */
// Temporary function to add missing athlete IDs to efforts table
async function updateEffortsForAllSegments() {
  console.log("updateEffortsForAllSegments starting");
  const segments = await db.query("SELECT id FROM segments");
  if (segments.length) {
    await Promise.all(
      segments.slice(0, 10).map(async segment => {
        if (!segment.id) return;
        try {
          let entries = [];
          let entry_count;
          let page = 1;
          while (true) {
            // while there are still pages with segments
            const leaderboard = await StravaAPIRequest(
              `segments/${segment.id}/leaderboard?page=${page}&per_page=200`
            );
            entry_count = leaderboard.entry_count;
            entries = [...entries, ...leaderboard.entries];
            if (entry_count / 200 < page) break;
            page++;
          }
          // Make a list of leaderboard efforts that aren't already recorded
          const db_efforts = await db.query(
            "SELECT * from segment_efforts WHERE segment_id = $1",
            [segment.id]
          );
          const new_effort_ids = _.difference(
            entries.map(e => parseInt(e.effort_id)),
            db_efforts.map(e => parseInt(e.effort_id))
          );
          // Update existing efforts
          const existing_effort_ids = _.difference(
            entries.map(e => parseInt(e.effort_id)),
            new_effort_ids
          );
          const existing_efforts = _.uniqBy(
            entries.filter(effort =>
              existing_effort_ids.includes(effort.effort_id)
            ),
            "effort_id"
          );
          console.log("updating efforts", existing_efforts.length, segment.id);
          await Promise.all(
            existing_efforts.map(async effort => {
              await db.query(
                "UPDATE segment_efforts SET athlete_id = $1 WHERE effort_id = $2",
                [effort.athlete_id, effort.effort_id]
              );
            })
          );
        } catch (err) {
          console.log("updateEffortsForAllSegments caught", err);
        }
      })
    ).catch(err => console.log(err));
  }
}
