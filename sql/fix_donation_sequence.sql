-- Reset the donations table sequence so INSERTs can autoincrement again.
-- Run this in psql or any Postgres client connected to your database.

SELECT
  setval(
    pg_get_serial_sequence('donations', 'donationid'),
    COALESCE((SELECT MAX(donationid) FROM donations), 0) + 1,
    false
  );

-- If you prefer the next INSERT to reuse the maximum value (instead of max + 1),
-- change the third argument to true.
