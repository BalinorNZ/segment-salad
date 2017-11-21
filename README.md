Required:  

Postgres database:  
[install instructions here](http://duspviz.mit.edu/tutorials/intro-postgis.php)  

PostGIS for Postgres 10 (it's missing from Stack Builder):  
[download here](http://download.osgeo.org/postgis/windows/pg10/)

To enable PostGIS on a database do:
1. open pgAdmin
2. select (click) your database
3. click "SQL" icon on the bar
4. run "CREATE EXTENSION postgis;" code

Adding created/modified in postgres:
BEGIN;

ALTER TABLE customer_
   ADD COLUMN row_modified_ TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp();

ALTER TABLE invoice_
   ADD COLUMN row_modified_ TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp();


ALTER TABLE customer_
   ADD COLUMN row_created_ TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp();

ALTER TABLE invoice_
   ADD COLUMN row_created_ TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp();


CREATE OR REPLACE FUNCTION update_row_modified_function_()
RETURNS TRIGGER 
AS 
$$
BEGIN
    -- ASSUMES the table has a column named exactly "row_modified_".
    -- Fetch date-time of actual current moment from clock, rather than start of statement or start of transaction.
    NEW.row_modified_ = clock_timestamp(); 
    RETURN NEW;
END;
$$ 
language 'plpgsql';

CREATE TRIGGER row_mod_on_customer_trigger_
BEFORE UPDATE
ON customer_ 
FOR EACH ROW 
EXECUTE PROCEDURE update_row_modified_function_();

CREATE TRIGGER row_mod_on_invoice_trigger_
BEFORE UPDATE
ON invoice_ 
FOR EACH ROW 
EXECUTE PROCEDURE update_row_modified_function_();

COMMIT;