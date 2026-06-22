CREATE TABLE IF NOT EXISTS tournaments (
  id          TEXT PRIMARY KEY,
  admin_token TEXT NOT NULL,
  name        TEXT,
  data_json   TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);
