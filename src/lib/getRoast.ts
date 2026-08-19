import type { Env, Platform, RoastResult } from './types';
import {
  resolveAccountId,
  resolveApiKey,
  getCurrentSeasonId,
  getLifetimeStats,
  getRankedStats,
  getWeaponMastery,
  getSurvivalMastery,
} from './pubgApi';
import { getCachedRoast, getCachedAccountId, saveRoast, logLookup } from './db';
import { generateRoast } from './roastEngine';

export async function getRoastForPlayer(
  env: Env,
  playerName: string,
  platform: Platform
): Promise<RoastResult> {
  // 1. Try to skip the name -> accountId API call using a cached mapping.
  let accountId = await getCachedAccountId(env, playerName, platform);

  // 2. If we know the accountId, check for a fresh cached roast first —
  //    this is the path that avoids calling the PUBG API at all.
  if (accountId) {
    const cached = await getCachedRoast(env, accountId, platform);
    if (cached) {
      await logLookup(env, playerName, platform, true);
      return cached;
    }
  }

  // 3. Cache miss (or unknown player) — hit the PUBG API. Resolve the key
  //    once here: works whether PUBG_API_KEY is a plain Secret (string) or
  //    a Secrets Store binding (object with .get()).
  const apiKey = await resolveApiKey(env.PUBG_API_KEY);

  const displayName = playerName;
  if (!accountId) {
    const resolved = await resolveAccountId(platform, playerName, apiKey);
    accountId = resolved.accountId;
  } else {
    // Double check the row wasn't stale-but-present; re-check cache once more
    // in case another request warmed it between steps 1 and 3 (best-effort,
    // not a hard lock — D1 doesn't need one for this use case).
    const cached = await getCachedRoast(env, accountId, platform);
    if (cached) {
      await logLookup(env, playerName, platform, true);
      return cached;
    }
  }

  const seasonId = await getCurrentSeasonId(platform, apiKey);

  const [lifetime, ranked, weapons, survival] = await Promise.all([
    getLifetimeStats(platform, accountId, seasonId, apiKey),
    getRankedStats(platform, accountId, seasonId, apiKey),
    getWeaponMastery(platform, accountId, apiKey).catch((err) => {
      console.error('Weapon mastery fetch failed, continuing without it:', err);
      return null;
    }),
    getSurvivalMastery(platform, accountId, apiKey).catch((err) => {
      console.error('Survival mastery fetch failed, continuing without it:', err);
      return null;
    }),
  ]);

  const roast = generateRoast({
    playerName: displayName,
    platform,
    seasonId,
    lifetime,
    ranked,
    weapons,
    survival,
  });

  await saveRoast(env, accountId, platform, roast, { lifetime, ranked, weapons, survival });
  await logLookup(env, playerName, platform, false);

  return roast;
}
