import type { Env, Platform, RoastResult } from './types';

interface CacheRow {
  account_id: string;
  platform: string;
  player_name: string;
  season_id: string;
  roast_json: string;
  roast_score: number;
  fetched_at: number;
}

export function ttlMillis(env: Env): number {
  const hours = Number(env.CACHE_TTL_HOURS ?? '6');
  return hours * 60 * 60 * 1000;
}

/** Look up a fresh cached roast by accountId. Returns null on miss or stale. */
export async function getCachedRoast(
  env: Env,
  accountId: string,
  platform: Platform
): Promise<RoastResult | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM player_cache WHERE account_id = ? AND platform = ?`
  )
    .bind(accountId, platform)
    .first<CacheRow>();

  if (!row) return null;

  const age = Date.now() - row.fetched_at;
  if (age > ttlMillis(env)) return null;

  const roast = JSON.parse(row.roast_json) as RoastResult;
  roast.cacheHit = true;
  return roast;
}

/** Look up an accountId by cached player name, so a repeat search for the
 *  same name doesn't need another name -> accountId API call either. */
export async function getCachedAccountId(
  env: Env,
  playerName: string,
  platform: Platform
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT account_id, fetched_at FROM player_cache
     WHERE platform = ? AND player_name = ? COLLATE NOCASE
     ORDER BY fetched_at DESC LIMIT 1`
  )
    .bind(platform, playerName)
    .first<{ account_id: string; fetched_at: number }>();

  if (!row) return null;
  if (Date.now() - row.fetched_at > ttlMillis(env)) return null;
  return row.account_id;
}

export async function saveRoast(
  env: Env,
  accountId: string,
  platform: Platform,
  roast: RoastResult,
  rawJson: { lifetime: unknown; ranked: unknown; weapons: unknown; survival: unknown }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO player_cache
       (account_id, platform, player_name, season_id, lifetime_json, ranked_json,
        weapon_json, survival_json, roast_json, roast_score, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, platform) DO UPDATE SET
       player_name = excluded.player_name,
       season_id = excluded.season_id,
       lifetime_json = excluded.lifetime_json,
       ranked_json = excluded.ranked_json,
       weapon_json = excluded.weapon_json,
       survival_json = excluded.survival_json,
       roast_json = excluded.roast_json,
       roast_score = excluded.roast_score,
       fetched_at = excluded.fetched_at`
  )
    .bind(
      accountId,
      platform,
      roast.playerName,
      roast.seasonId,
      JSON.stringify(rawJson.lifetime),
      JSON.stringify(rawJson.ranked),
      JSON.stringify(rawJson.weapons),
      JSON.stringify(rawJson.survival),
      JSON.stringify(roast),
      roast.roastScore,
      Date.now()
    )
    .run();
}

export async function logLookup(
  env: Env,
  playerName: string,
  platform: Platform,
  cacheHit: boolean
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO lookup_log (player_name, platform, cache_hit, created_at) VALUES (?, ?, ?, ?)`
    )
      .bind(playerName, platform, cacheHit ? 1 : 0, Date.now())
      .run();
  } catch {
    // Non-critical — never let logging break a roast request.
  }
}
