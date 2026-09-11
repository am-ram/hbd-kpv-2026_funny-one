CREATE TABLE IF NOT EXISTS birthday_events (
  event_id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  occurred_at timestamptz NOT NULL,
  ip_address inet,
  user_agent varchar(512),
  origin varchar(256),
  path varchar(256) NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS birthday_events_session_time ON birthday_events(session_id, received_at);
CREATE OR REPLACE VIEW birthday_events_ist AS
SELECT *, received_at AT TIME ZONE 'Asia/Kolkata' AS received_at_ist,
occurred_at AT TIME ZONE 'Asia/Kolkata' AS occurred_at_ist FROM birthday_events;

-- Separate gallery storage; preserve all existing poster events.
CREATE TABLE IF NOT EXISTS gallery_events (
  event_id uuid PRIMARY KEY,
  session_id uuid NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  occurred_at timestamptz NOT NULL,
  ip_address inet,
  user_agent varchar(512),
  origin varchar(256),
  path varchar(256) NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS gallery_events_session_time ON gallery_events(session_id, received_at);
CREATE OR REPLACE VIEW gallery_events_ist AS
SELECT *, received_at AT TIME ZONE 'Asia/Kolkata' AS received_at_ist,
occurred_at AT TIME ZONE 'Asia/Kolkata' AS occurred_at_ist FROM gallery_events;
