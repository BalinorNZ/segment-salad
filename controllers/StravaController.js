/**
 * Strava Controller
 */
const db = require("../db");
const Manager = require('../db/StravaManager.js');


module.exports = {
  // TODO: this doesn't work yet
  authenticate: async () => Manager.authenticate(),

  list_clubs: async () => Manager.StravaAPIRequest('athlete/clubs'),

  //TODO: this only gets the first 200 members of the club at the moment
  segmentsByClub: async club_id => {
    const club_members = await Manager.StravaAPIRequest(`clubs/${club_id}/members?per_page=200`);
    return await db.query(Manager.buildEffortQuery('athlete_id', club_members.map(member => member.id)));
  },

  activities: async page => Manager.StravaAPIRequest(`athlete/activities?page=${page}&per_page=50`),

  athleteStats: async id => Manager.StravaAPIRequest(`athletes/${id}/stats`),

  athleteZones: async () => Manager.StravaAPIRequest(`athlete/zones`),

  segmentLeaderboard: async (id, page) =>
    Manager.StravaAPIRequest(`segments/${id}/leaderboard?page=${page}&per_page=200`),

  segmentListEfforts: async id => Manager.StravaAPIRequest(`segments/${id}/all_efforts?per_page=200`),

  // TODO: when scanning segments, if the modified date (efforts count) is old, re-request efforts
  // TODO: check if elevation_gain is zero even if max_elevation and min_elevation are quite different
  updateSegmentLeaderboard: async segment_id => Manager.updateSegmentLeaderboard(segment_id),

  // TODO: add athlete ID to efforts in efforts table, so we can filter by it
  segmentPBsForAthlete: async athlete_id => await db.query(Manager.buildEffortQuery('athlete_id', athlete_id)),

  //TODO: Use GraphQL to query everything
  segmentsExplore: async rect_coords => Manager.segmentsExplore(rect_coords),

  // Temporary function to add missing athlete IDs to efforts table
  updateEffortsForAllSegments: async () => Manager.updateEffortsForAllSegments(),

  updateAllLeaderboards: async () => {
    console.log("updateAllLeaderboards starting");
    const segments = await db.query("SELECT id FROM segments");
    if(segments.length) {
      // update leaderboards for segments
      await Promise.all(segments.map(async segment => {
        const leaderboard = await Manager.updateSegmentLeaderboard(segment.id);
        return Object.assign({}, segment, leaderboard);
      }));
    }
  },
};