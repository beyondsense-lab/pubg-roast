-- pubg-roast D1 schema
-- One row per (platform, accountId). Re-fetching from the PUBG API only
-- happens when the row is missing or older than CACHE_TTL_HOURS.

CREATE TABLE IF NOT EXISTS player_cache (
  account_id     TEXT NOT NULL,
  platform       TEXT NOT NULL,
  player_name    TEXT NOT NULL,
  season_id      TEXT NOT NULL,
  lifetime_json  TEXT,
  ranked_json    TEXT,
  weapon_json    TEXT,
  survival_json  TEXT,
  roast_json     TEXT NOT NULL,
  roast_score    INTEGER NOT NULL,
  fetched_at     INTEGER NOT NULL, -- unix ms
  PRIMARY KEY (account_id, platform)
);

-- Lets us resolve "PlayerName + platform" -> cached row without another
-- name->id lookup call against the PUBG API.
CREATE INDEX IF NOT EXISTS idx_player_name
  ON player_cache (platform, player_name);

-- Lightweight request log, mostly useful for eyeballing traffic /
-- rate-limit pressure from the D1 console. Safe to drop if unwanted.
CREATE TABLE IF NOT EXISTS lookup_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name  TEXT NOT NULL,
  platform     TEXT NOT NULL,
  cache_hit    INTEGER NOT NULL, -- 0 or 1
  created_at   INTEGER NOT NULL
);
