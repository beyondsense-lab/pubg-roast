import type {
  Platform,
  Env,
  LifetimeStatsResponse,
  RankedStatsResponse,
  WeaponMasteryResponse,
  SurvivalMasteryResponse,
} from './types';

const BASE = 'https://api.pubg.com';

export class PubgApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'PubgApiError';
  }
}

/** Resolves either a plain-text Secret or a Secrets Store binding to a string. */
export async function resolveApiKey(raw: Env['PUBG_API_KEY']): Promise<string> {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw.get === 'function') return raw.get();
  throw new PubgApiError('PUBG_API_KEY binding is missing or in an unrecognized shape', 401);
}

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/vnd.api+json',
  };
}

async function call<T>(url: string, apiKey: string): Promise<T> {
  const res = await fetch(url, { headers: headers(apiKey) });

  if (res.status === 404) {
    throw new PubgApiError('Player or resource not found', 404);
  }
  if (res.status === 401) {
    throw new PubgApiError('PUBG API key invalid or missing', 401);
  }
  if (res.status === 429) {
    throw new PubgApiError('Rate limited by the PUBG API — try again shortly', 429);
  }
  if (!res.ok) {
    throw new PubgApiError(`PUBG API request failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

/** Resolve a player's display name to their PUBG accountId on a given shard. */
export async function resolveAccountId(
  platform: Platform,
  playerName: string,
  apiKey: string
): Promise<{ accountId: string; displayName: string }> {
  const url = `${BASE}/shards/${platform}/players?filter[playerNames]=${encodeURIComponent(
    playerName
  )}`;
  const json = await call<{ data: Array<{ id: string; attributes: { name: string } }> }>(
    url,
    apiKey
  );
  if (!json.data || json.data.length === 0) {
    throw new PubgApiError(`No player named "${playerName}" found on ${platform}`, 404);
  }
  return { accountId: json.data[0].id, displayName: json.data[0].attributes.name };
}

/** Find the current PUBG ranked/lifetime season id for a shard. */
export async function getCurrentSeasonId(platform: Platform, apiKey: string): Promise<string> {
  const url = `${BASE}/shards/${platform}/seasons`;
  const json = await call<{ data: Array<{ id: string; attributes: { isCurrentSeason: boolean } }> }>(
    url,
    apiKey
  );
  const current = json.data.find((s) => s.attributes.isCurrentSeason);
  if (!current) {
    throw new PubgApiError('Could not determine current PUBG season', 500);
  }
  return current.id;
}

export function getLifetimeStats(
  platform: Platform,
  accountId: string,
  seasonId: string,
  apiKey: string
): Promise<LifetimeStatsResponse> {
  const url = `${BASE}/shards/${platform}/players/${accountId}/seasons/${seasonId}`;
  return call<LifetimeStatsResponse>(url, apiKey);
}

export async function getRankedStats(
  platform: Platform,
  accountId: string,
  seasonId: string,
  apiKey: string
): Promise<RankedStatsResponse | null> {
  const url = `${BASE}/shards/${platform}/players/${accountId}/seasons/${seasonId}/ranked`;
  try {
    return await call<RankedStatsResponse>(url, apiKey);
  } catch (err) {
    // Ranked data is legitimately absent for players who haven't queued ranked
    // this season — don't fail the whole roast over it.
    if (err instanceof PubgApiError && err.status === 404) return null;
    throw err;
  }
}
/** Normalizes a response that may or may not be wrapped in a top-level
 *  "data" envelope — the PUBG docs are inconsistent about this for the
 *  mastery endpoints (their own Example Value and Model schema disagree),
 *  and different accounts/shards have been observed returning both shapes. */
function unwrap<T extends { attributes?: unknown }>(raw: any): T {
  const root = raw && typeof raw === 'object' && 'data' in raw ? raw.data : raw;
  return root as T;
}

export async function getWeaponMastery(
  platform: Platform,
  accountId: string,
  apiKey: string
): Promise<WeaponMasteryResponse> {
  const url = `${BASE}/shards/${platform}/players/${accountId}/weapon_mastery`;
  const raw = await call<any>(url, apiKey);
  const normalized = unwrap<WeaponMasteryResponse>(raw);
  if (!normalized?.attributes) {
    throw new PubgApiError('Weapon mastery response was missing "attributes" in both flat and data-wrapped shapes', 502);
  }
  return normalized;
}

export async function getSurvivalMastery(
  platform: Platform,
  accountId: string,
  apiKey: string
): Promise<SurvivalMasteryResponse> {
  const url = `${BASE}/shards/${platform}/players/${accountId}/survival_mastery`;
  const raw = await call<any>(url, apiKey);
  const normalized = unwrap<SurvivalMasteryResponse>(raw);
  if (!normalized?.attributes) {
    throw new PubgApiError('Survival mastery response was missing "attributes" in both flat and data-wrapped shapes', 502);
  }
  return normalized;
}
