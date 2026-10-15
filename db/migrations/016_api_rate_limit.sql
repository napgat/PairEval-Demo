CREATE TABLE api_rate_window (
 user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
 bucket text NOT NULL CHECK(bucket IN ('requests','exports')),
 window_start timestamptz NOT NULL, n integer NOT NULL,
 PRIMARY KEY(user_id,bucket,window_start)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON api_rate_window TO paireval_operational_app;
