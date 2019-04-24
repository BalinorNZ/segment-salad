--
-- PostgreSQL database dump
--

-- Dumped from database version 10.0
-- Dumped by pg_dump version 10.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

SET search_path = public, pg_catalog;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE activities (
--    id bigint NOT NULL,
--    name text NOT NULL,
--    climb_category integer,
--    climb_category_desc text,
--    avg_grade real,
--    elev_difference real,
--    distance real,
--    points text,
--    start_latlng point,
--    end_latlng point,
--    entry_count integer,
    modified timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    created timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


ALTER TABLE activities OWNER TO postgres;

--
-- Name: segments segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: segments row_mod_on_invoice_trigger_; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER row_mod_on_invoice_trigger_ BEFORE UPDATE ON activities FOR EACH ROW EXECUTE PROCEDURE update_row_modified_function_();


--
-- PostgreSQL database dump complete
--

--activity_id
--athlete_id
--name
--distance
--moving_time
--elapsed_time
--total_elevation_gain
--type
--workout_type
--external_id
--upload_id
--start_date
--start_date_local
--utc_offset
--start_latlng
--end_latlng
--achievement_count
--kudos_count
--comment_count
--athlete_count
--photo_count

--scanAllActivitiesForNewSegments
--{ resource_state: 3,
--  athlete: { id: 4734138, resource_state: 1 },
--  name: 'Morning Run',
--  distance: 3437.6,
--  moving_time: 950,
--  elapsed_time: 966,
--  total_elevation_gain: 15.2,
--  type: 'Run',
--  workout_type: null,
--  id: 2297789612,
--  external_id: 'garmin_push_3565422015',
--  upload_id: 2445457778,
--  start_date: '2019-04-17T20:38:06Z',
--  start_date_local: '2019-04-18T08:38:06Z',
--  timezone: '(GMT+12:00) Pacific/Auckland',
--  utc_offset: 43200,
--  start_latlng: [ -45.9, 170.53 ],
--  end_latlng: [ -45.88, 170.5 ],
--  location_city: null,
--  location_state: null,
--  location_country: 'New Zealand',
--  start_latitude: -45.9,
--  start_longitude: 170.53,
--  achievement_count: 0,
--  kudos_count: 13,
--  comment_count: 0,
--  athlete_count: 2,
--  photo_count: 0,
--  map:
--   { id: 'a2297789612',
--     polyline:
--      'fucwGuyxo_@uAnBUb@UXWf@KHMASUi@WeB_C]a@EAE?i@Ja@Pq@PQXw@tBCL@hAOhA?j@JfA?p@C^a@t@[z@QZOLSFG?SEu@k@w@w@OK]MK?WFKHINGROnAA`BOlBMl@K`BQ|A]pBG~@GVIHW?ER?PJn@B\\KzAYhA[zBg@rBkBzJg@bBO|@Sn@c@zB}@jCq@bAgApAmAxAeBjB}BxCwBbC
--y@bAmAxAg@p@yAzAmBbC}@|@eAnAw@p@]Pg@NSBYEK@k@XgEr@mAZiBn@wAVm@Nk@@i@Kq@a@wAo@_Ao@e@UKMCYBOHEFJ@HCHGAAEBMBCD@BLAPMXIJo@TQJW\\GNI`@[lBIVGLSlBEJE@UKLFBBALGb@GFG?SGYS',
--     resource_state: 3,
--     summary_polyline: 'zgcwG}xxo_@}CrDG~IqAtCyGaAcDz\\}Kfe@q`@pd@}UdF{GaFsE`O}@S' },
--  trainer: false,
--  commute: true,
--  manual: false,
--  private: false,
--  visibility: 'everyone',
--  flagged: false,
--  gear_id: 'g3319886',
--  from_accepted_tag: false,
--  average_speed: 3.619,
--  max_speed: 5,
--  average_cadence: 87,
--  has_heartrate: true,
--  average_heartrate: 136.7,
--  max_heartrate: 154,
--  heartrate_opt_out: false,
--  display_hide_heartrate_option: true,
--  elev_high: 21.2,
--  elev_low: 1.9,
--  pr_count: 0,
--  total_photo_count: 0,
--  has_kudoed: false,
--  description: null,
--  calories: 185,
--  segment_efforts:
--   [ { id: 58053132527,
--       resource_state: 2,
--       name: 'Straight to teeth',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 402,
--       moving_time: 393,
--       start_date: '2019-04-17T20:42:01Z',
--       start_date_local: '2019-04-18T08:42:01Z',
--       distance: 1445.8,
--       start_index: 152,
--       end_index: 547,
--       average_cadence: 86.5,
--       average_heartrate: 140.3,
--       max_heartrate: 146,
--       segment: [Object],
--       kom_rank: null,
--       pr_rank: null,
--       achievements: [],
--       hidden: false },
--     { id: 58053132543,
--       resource_state: 2,
--       name: 'Final straight to teeth',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 300,
--       moving_time: 300,
--       start_date: '2019-04-17T20:43:45Z',
--       start_date_local: '2019-04-18T08:43:45Z',
--       distance: 1107,
--       start_index: 249,
--       end_index: 549,
--       average_cadence: 86,
--       average_heartrate: 141.8,
--       max_heartrate: 146,
--       segment: [Object],
--       kom_rank: null,
--       pr_rank: null,
--       achievements: [],
--       hidden: false } ],
--  splits_metric:
--   [ { distance: 1002.3,
--       elapsed_time: 279,
--       elevation_difference: -9.3,
--       moving_time: 279,
--       split: 1,
--       average_speed: 3.59,
--       average_heartrate: 124.66909090909091,
--       pace_zone: 0 },
--     { distance: 1002.3,
--       elapsed_time: 280,
--       elevation_difference: -9.7,
--       moving_time: 272,
--       split: 2,
--       average_speed: 3.68,
--       average_heartrate: 140.55555555555554,
--       pace_zone: 0 },
--     { distance: 995.7,
--       elapsed_time: 270,
--       elevation_difference: 6.6,
--       moving_time: 270,
--       split: 3,
--       average_speed: 3.69,
--       average_heartrate: 143.60476190476192,
--       pace_zone: 0 },
--     { distance: 437.3,
--       elapsed_time: 138,
--       elevation_difference: 1.2,
--       moving_time: 129,
--       split: 4,
--       average_speed: 3.39,
--       average_heartrate: 145.89814814814815,
--       pace_zone: 0 } ],
--  splits_standard:
--   [ { distance: 1609.6,
--       elapsed_time: 454,
--       elevation_difference: -18.6,
--       moving_time: 446,
--       split: 1,
--       average_speed: 3.61,
--       average_heartrate: 129.60287081339712,
--       pace_zone: 0 },
--     { distance: 1616,
--       elapsed_time: 440,
--       elevation_difference: 7.8,
--       moving_time: 440,
--       split: 2,
--       average_speed: 3.67,
--       average_heartrate: 143.90116279069767,
--       pace_zone: 0 },
--     { distance: 212,
--       elapsed_time: 73,
--       elevation_difference: -0.4,
--       moving_time: 64,
--       split: 3,
--       average_speed: 3.31,
--       average_heartrate: 145.48214285714286,
--       pace_zone: 0 } ],
--  laps:
--   [ { id: 7522907292,
--       resource_state: 2,
--       name: 'Lap 1',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 966,
--       moving_time: 950,
--       start_date: '2019-04-17T20:38:06Z',
--       start_date_local: '2019-04-18T08:38:06Z',
--       distance: 3437.57,
--       start_index: 0,
--       end_index: 869,
--       total_elevation_gain: 93,
--       average_speed: 3.62,
--       max_speed: 5,
--       average_cadence: 87,
--       average_heartrate: 136.7,
--       max_heartrate: 154,
--       lap_index: 1,
--       split: 1,
--       pace_zone: 0 } ],
--  best_efforts:
--   [ { id: 4897535123,
--       resource_state: 2,
--       name: '400m',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 106,
--       moving_time: 107,
--       start_date: '2019-04-17T20:44:27Z',
--       start_date_local: '2019-04-18T08:44:27Z',
--       distance: 400,
--       start_index: 291,
--       end_index: 398,
--       pr_rank: null,
--       achievements: [] },
--     { id: 4897535124,
--       resource_state: 2,
--       name: '1/2 mile',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 223,
--       moving_time: 224,
--       start_date: '2019-04-17T20:38:09Z',
--       start_date_local: '2019-04-18T08:38:09Z',
--       distance: 805,
--       start_index: 0,
--       end_index: 144,
--       pr_rank: null,
--       achievements: [] },
--     { id: 4897535125,
--       resource_state: 2,
--       name: '1k',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 276,
--       moving_time: 277,
--       start_date: '2019-04-17T20:38:10Z',
--       start_date_local: '2019-04-18T08:38:10Z',
--       distance: 1000,
--       start_index: 0,
--       end_index: 198,
--       pr_rank: null,
--       achievements: [] },
--     { id: 4897535127,
--       resource_state: 2,
--       name: '1 mile',
--       activity: [Object],
--       athlete: [Object],
--       elapsed_time: 450,
--       moving_time: 442,
--       start_date: '2019-04-17T20:38:17Z',
--       start_date_local: '2019-04-18T08:38:17Z',
--       distance: 1609,
--       start_index: 0,
--       end_index: 372,
--       pr_rank: null,
--       achievements: [] } ],
--  gear:
--   { id: 'g3319886',
--     primary: true,
--     name: 'Nike Pegasus 35 Black',
--     resource_state: 2,
--     distance: 1142419 },
--  photos: { primary: null, count: 0 },
--  device_name: 'Garmin Forerunner 235',
--  embed_token: 'ad7f74ce51f49b58090e768d36fe8a9f9d2fde22',
--  similar_activities:
--   { effort_count: 200,
--     average_speed: 3.525671805775266,
--     min_average_speed: 3.0103658536585365,
--     mid_average_speed: 3.635746282861857,
--     max_average_speed: 4.589095744680851,
--     pr_rank: null,
--     frequency_milestone: null,
--     trend:
--      { speeds: [Array],
--        current_activity_index: 4,
--        min_speed: 3.0103658536585365,
--        mid_speed: 3.635746282861857,
--        max_speed: 4.589095744680851,
--        direction: 1 },
--     resource_state: 2 },
--  available_zones: [] }
--Found 0 new segments in 2 efforts from 1426 activities.
