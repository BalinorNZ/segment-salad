# Segment Salad

Segment Salad is a prototype project that maps Strava segments for easy color coding and filtering.

## Setup

Check out the segment-salad repo along with client submodule (--recursive flag gets client submodule):  
`git clone --recursive git@github.com:BalinorNZ/segment-salad.git`

Run `npm install` in the root folder and the client folder.
The Client uses Create-react-app. Run `npm start` in two separate terminals in each of the
root and client folders.

Create a file called `strava_config` in a folder called `data` at the project root with the following inside:
```
module.exports = {
    "access_token"    :"enter your access_token here"
    , "client_id"     :"enter your client id here"
    , "client_secret" :"enter your client secret here"
    , "redirect_uri"  :"http://localhost:3000/"
};
```

A. Install Postgres database:  
[install instructions here](http://duspviz.mit.edu/tutorials/intro-postgis.php)  

B. Install PostGIS for Postgres 10 (it's missing from Stack Builder):  
[download here](http://download.osgeo.org/postgis/windows/pg10/)

C. Enable PostGIS:
1. open pgAdmin
2. select (click) your database
3. click "SQL" icon on the bar
4. run "CREATE EXTENSION postgis;" code

[Add instructions about creating a new database and schema in pgAdmin]

D. Import table backups for rectangles, segment_efforts and segments from /schemas folder.