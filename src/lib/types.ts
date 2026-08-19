export type Platform =
  | 'steam'
  | 'psn'
  | 'xbox'
  | 'kakao'
  | 'stadia';

export interface Env {
  DB: D1Database;
  // A Secrets Store binding exposes `.get()` instead of a plain string;
  // resolveApiKey() below normalizes either shape to a plain string.
  PUBG_API_KEY: string | { get(): Promise<string> };
  CACHE_TTL_HOURS?: string;
  DEFAULT_PLATFORM?: string;
}

export interface GameModeStats {
  assists: number;
  boosts: number;
  dBNOs: number;
  damageDealt: number;
  headshotKills: number;
  heals: number;
  kills: number;
  longestKill: number;
  longestTimeSurvived: number;
  losses: number;
  maxKillStreaks: number;
  revives: number;
  rideDistance: number;
  roadKills: number;
  roundMostKills: number;
  roundsPlayed: number;
  suicides: number;
  swimDistance: number;
  teamKills: number;
  timeSurvived: number;
  top10s: number;
  vehicleDestroys: number;
  walkDistance: number;
  weaponsAcquired: number;
  wins: number;
  [key: string]: number;
}

export type GameMode =
  | 'solo' | 'solo-fpp'
  | 'duo' | 'duo-fpp'
  | 'squad' | 'squad-fpp';

export interface LifetimeStatsResponse {
  data: {
    type: string;
    attributes: {
      gameModeStats: Partial<Record<GameMode, GameModeStats>>;
    };
  };
}

export interface RankedGameModeStats {
  currentRankPoint: number;
  bestRankPoint: number;
  currentTier: { tier: string; subTier: string };
  bestTier: { tier: string; subTier: string };
  roundsPlayed: number;
  avgRank: number;
  avgSurvivalTime: number;
  top10Ratio: number;
  winRatio: number;
  assists: number;
  wins: number;
  kda: number;
  kdr: number;
  kills: number;
  deaths: number;
  roundMostKills: number;
  longestKill: number;
  headshotKills: number;
  headshotKillRatio: number;
  damageDealt: number;
  dBNOs: number;
  reviveRatio: number;
  revives: number;
  heals: number;
  boosts: number;
  weaponsAcquired: number;
  teamKills: number;
  playTime: number;
  killStreak: number;
}

export interface RankedStatsResponse {
  data: {
    type: string;
    attributes: {
      rankedGameModeStats: Partial<Record<'squad' | 'squad-fpp', RankedGameModeStats>>;
    };
  };
}

export interface WeaponStatsTotal {
  MostDefeatsInAGame: number;
  Defeats: number;
  MostDamagePlayerInAGame: number;
  DamagePlayer: number;
  MostHeadShotsInAGame: number;
  HeadShots: number;
  LongestDefeat: number;
  LongRangeDefeats: number;
  Kills: number;
  MostKillsInAGame: number;
  Groggies: number;
  MostGroggiesInAGame: number;
}

export interface WeaponSummary {
  XPTotal: number;
  LevelCurrent: number;
  TierCurrent: number;
  StatsTotal: WeaponStatsTotal;
}

export interface WeaponMasteryResponse {
  accountId: string;
  attributes: {
    platform: string;
    weaponSummaries: Record<string, WeaponSummary>;
    latestMatchId: string;
  };
}

export interface SurvivalMasteryResponse {
  type: string;
  id: string;
  attributes: {
    xp: number;
    tier: number;
    level: number;
    totalMatchesPlayed: number;
    latestMatchId: string;
    stats: Array<{
      statid: string;
      total: number;
      average: number;
      careerBest: number;
      lastMatchValue: number;
    }>;
  };
}

export interface RoastCard {
  id: string;
  category: 'combat' | 'weapons' | 'survival' | 'ranked' | 'maps' | 'intro';
  emoji: string;
  title: string;
  headline: string;
  body: string;
  statLine: string;
  severity: 1 | 2 | 3 | 4 | 5; // 5 = most brutal
}

export interface RoastResult {
  playerName: string;
  platform: Platform;
  seasonId: string;
  mainMode: GameMode;
  roastScore: number; // 0-100, higher = more roastable
  roastTitle: string;
  cards: RoastCard[];
  generatedAt: number;
  cacheHit: boolean;
}
