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

The following database setup instructions are based on this article:
[install instructions here](http://duspviz.mit.edu/tutorials/intro-postgis.php) 

### Download and install Postgres DB (version 10 or latest version)
1. Download Postgres db from [here](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)  
2. Use the default Installation Directory
3. Also, use the default Data Directory (We can always change this later)
4. Input a password for the superuser (default database adminstrator account with name postgres). IMPORTANT: DO NOT FORGET THIS PASSWORD. WITHOUT IT YOU CANNOT LOG IN AND WILL NEED TO START OVER.  
- Default password is 'postgres', if you use a different password, update the password in /db/index.js
5. The default port is 5432, use it.
6. Set the Locale to be the default.
7. Click OK to begin the install.
8. After install, click Allow to let the application accept incoming network requests
9. Launch StackBuilder to install PostGIS (under Spatial Extensions).

If PostGIS for Postgres 10 is missing from Stack Builder download and install it from [here](http://download.osgeo.org/postgis/windows/pg10/).

### Create the Database Server
1. Open pgAdmin application
2. Right click 'Servers' in the browser pane and select Create > Server
3. Name it whatever you like.
4. Hostname/address to 'localhost'
5. Username: postgres
6. Password: postgres (or whatever you set in db/index.js)
7. Save password? yes.
8. Click save.

### Create the Database
1. In pgAdmin right click the server you just made in the browser pane and Create > Database
2. Set Database to 'segmentsalad' (or whatever you set database to in db/index.js)
3. Click save.

### Enable PostGIS:
1. In pgAdmin Browser pane rightclick your database and select 'Query tool'.
2. run this SQL "CREATE EXTENSION postgis;" (click lightning bolt to run query).

### Import Tables and Data
1. Copy the SQL from the file create-function-update_row_modified in /schemas folder
2. Run it in the pgAdmin query tool.
3. Copy the SQL from each of the other files in /schemas folder into query tool to create tables.
4. The tables will appear under Server > segmentsalad > Schemas > public > Tables in pgAdmin browser.

### Load some pre-prepared segment data (Optional)
Ask Nic for a dump of his segments table to avoid having to scan for 500+ segments in Dunedin yourself!

### Start it up!
Run npm start in both the repo root directory and the client directory (in that order).  
