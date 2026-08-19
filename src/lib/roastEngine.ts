import type {
  GameMode,
  GameModeStats,
  LifetimeStatsResponse,
  RankedStatsResponse,
  WeaponMasteryResponse,
  SurvivalMasteryResponse,
  RoastCard,
  RoastResult,
  Platform,
} from './types';

/**
 * ── A note on the "benchmarks" below ──────────────────────────────────────
 * The PUBG API does not expose a live leaderboard/percentile endpoint, so
 * there's no ground truth to grade a player against. Everything here is an
 * opinionated heuristic tuned to feel roughly fair for a roast site, NOT a
 * verified statistical average. Tune BENCH freely — nothing downstream
 * depends on these numbers being "correct".
 */
const BENCH = {
  winRatio: 0.08, // ~1 win per 12-13 matches is a reasonable "fine" bar
  top10Ratio: 0.35,
  killsPerMatch: 2.2,
  avgDamagePerMatch: 220,
  headshotRatio: 0.18,
  survivalSeconds: 900, // 15 min avg survival on a ~30 min match timer
  walkToRideRatio: 0.4, // walkDistance should be a healthy fraction of total movement
  reviveToKnockRatio: 0.5,
  teamKillTolerance: 1,
  rankedKDA: 2.0,
};

const TIER_ORDER = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster',
];

function pct(n: number, d: number) {
  return d > 0 ? n / d : 0;
}

function pickMainMode(
  gameModeStats: Partial<Record<GameMode, GameModeStats>>
): { mode: GameMode; stats: GameModeStats } | null {
  let best: { mode: GameMode; stats: GameModeStats } | null = null;
  for (const [mode, stats] of Object.entries(gameModeStats) as [GameMode, GameModeStats][]) {
    if (!stats) continue;
    if (!best || stats.roundsPlayed > best.stats.roundsPlayed) {
      best = { mode, stats };
    }
  }
  return best;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

/** Converts "how far below benchmark" into a 0-100 badness score (100 = brutal). */
function badnessFromRatio(actual: number, benchmark: number, invert = false) {
  if (benchmark === 0) return 0;
  const ratio = invert ? benchmark / Math.max(actual, 0.001) : actual / benchmark;
  // ratio >= 1 means they meet/beat the benchmark -> low badness
  const badness = clamp((1 - ratio) * 100, 0, 100);
  return Math.round(badness);
}

function weaponDisplayName(itemId: string) {
  return itemId
    .replace(/^Item_Weapon_/, '')
    .replace(/_C$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

interface EngineInput {
  playerName: string;
  platform: Platform;
  seasonId: string;
  lifetime: LifetimeStatsResponse;
  ranked: RankedStatsResponse | null;
  weapons: WeaponMasteryResponse | null;
  survival: SurvivalMasteryResponse | null;
}

export function generateRoast(input: EngineInput): RoastResult {
  const { playerName, platform, seasonId, lifetime, ranked, weapons, survival } = input;
  const cards: RoastCard[] = [];
  const badnessScores: number[] = [];

  const main = pickMainMode(lifetime.data.attributes.gameModeStats);

  // ── Intro card ────────────────────────────────────────────────────────
  const totalRounds = Object.values(lifetime.data.attributes.gameModeStats).reduce(
    (sum, s) => sum + (s?.roundsPlayed ?? 0),
    0
  );

  if (!main || totalRounds === 0) {
    cards.push({
      id: 'intro-nodata',
      category: 'intro',
      emoji: '💤',
      title: 'Ghost Player',
      headline: `${playerName} has 0 recorded matches this season.`,
      body: "Can't roast a player who hasn't dropped in yet. The most damning stat of all is the absence of any stats.",
      statLine: '0 rounds played',
      severity: 3,
    });
    return {
      playerName,
      platform,
      seasonId,
      mainMode: 'squad',
      roastScore: 50,
      roastTitle: 'Undrafted',
      cards,
      generatedAt: Date.now(),
      cacheHit: false,
    };
  }

  const s = main.stats;
  const avgKills = pct(s.kills, s.roundsPlayed);
  const avgDamage = pct(s.damageDealt, s.roundsPlayed);
  const winRatio = pct(s.wins, s.roundsPlayed);
  const top10Ratio = pct(s.top10s, s.roundsPlayed);
  const headshotRatio = pct(s.headshotKills, s.kills);
  const avgSurvival = pct(s.timeSurvived, s.roundsPlayed);
  const walkRideRatio = pct(s.walkDistance, s.walkDistance + s.rideDistance + s.swimDistance);

  cards.push({
    id: 'intro-summary',
    category: 'intro',
    emoji: '📋',
    title: 'Combat Debrief',
    headline: `${playerName} — ${main.mode.toUpperCase()} main, ${s.roundsPlayed.toLocaleString()} matches deep.`,
    body: `${s.wins.toLocaleString()} wins, ${s.kills.toLocaleString()} kills, and a win rate of ${(
      winRatio * 100
    ).toFixed(1)}%. Let's see what that's actually built on.`,
    statLine: `${(winRatio * 100).toFixed(1)}% win rate · ${avgKills.toFixed(2)} kills/match`,
    severity: 1,
  });

  // ── Combat card ──────────────────────────────────────────────────────
  const combatBadness = Math.round(
    (badnessFromRatio(avgDamage, BENCH.avgDamagePerMatch) +
      badnessFromRatio(avgKills, BENCH.killsPerMatch) +
      badnessFromRatio(winRatio, BENCH.winRatio)) /
      3
  );
  badnessScores.push(combatBadness);

  cards.push({
    id: 'combat',
    category: 'combat',
    emoji: combatBadness >= 60 ? '🥔' : combatBadness >= 30 ? '🎯' : '💀',
    title: combatBadness >= 60 ? 'Damage Sponge' : combatBadness >= 30 ? 'Middle of the Pack' : 'Actual Threat',
    headline:
      combatBadness >= 60
        ? `${avgDamage.toFixed(0)} average damage per match. That's a warning shot, not a fight.`
        : combatBadness >= 30
        ? `${avgDamage.toFixed(0)} damage and ${avgKills.toFixed(2)} kills per match — perfectly forgettable.`
        : `${avgDamage.toFixed(0)} damage and ${avgKills.toFixed(2)} kills per match. Genuinely dangerous, annoyingly so.`,
    body:
      combatBadness >= 60
        ? `With a ${(winRatio * 100).toFixed(1)}% win rate over ${s.roundsPlayed} rounds, the loot goblin allegations write themselves — landing, looting, and losing to the first person who looks at them funny.`
        : `${s.headshotKills.toLocaleString()} headshots across ${s.kills.toLocaleString()} kills (${(
            headshotRatio * 100
          ).toFixed(1)}%) — enough to be a nuisance, not enough to be feared.`,
    statLine: `${avgDamage.toFixed(0)} dmg/match · ${(headshotRatio * 100).toFixed(1)}% headshot rate`,
    severity: (combatBadness >= 70 ? 5 : combatBadness >= 45 ? 4 : combatBadness >= 20 ? 3 : 2) as RoastCard['severity'],
  });

  // ── Survival card ────────────────────────────────────────────────────
  const survivalBadness = Math.round(
    (badnessFromRatio(avgSurvival, BENCH.survivalSeconds) +
      (s.teamKills > BENCH.teamKillTolerance ? clamp(s.teamKills * 15, 0, 100) : 0) +
      badnessFromRatio(walkRideRatio, BENCH.walkToRideRatio)) /
      3
  );
  badnessScores.push(survivalBadness);

  const teamKillLine =
    s.teamKills > 0
      ? ` And ${s.teamKills} team kill${s.teamKills === 1 ? '' : 's'} on record — friendly fire isn't friendly.`
      : '';

  cards.push({
    id: 'survival',
    category: 'survival',
    emoji: survivalBadness >= 60 ? '⚰️' : survivalBadness >= 30 ? '🏃' : '🛡️',
    title: survivalBadness >= 60 ? 'Early Checkout' : survivalBadness >= 30 ? 'Circle Chaser' : 'Zone Veteran',
    headline: `Average survival time: ${(avgSurvival / 60).toFixed(1)} minutes.`,
    body:
      survivalBadness >= 60
        ? `That's barely enough time to loot a compound before the third circle catches up.${teamKillLine}`
        : `Not bad for staying alive — ${(walkRideRatio * 100).toFixed(0)}% of all distance covered on foot, so at least the fear of fall damage is respected.${teamKillLine}`,
    statLine: `${(avgSurvival / 60).toFixed(1)} min avg survival · ${s.revives} revives given`,
    severity: (survivalBadness >= 70 ? 5 : survivalBadness >= 45 ? 4 : survivalBadness >= 20 ? 3 : 2) as RoastCard['severity'],
  });

  // ── Weapon mastery card ──────────────────────────────────────────────
  const weaponEntries = weapons
    ? Object.entries(weapons.attributes.weaponSummaries || {}).filter(
        ([, w]) => w.StatsTotal.Kills >= 5
      )
    : [];

  if (weaponEntries.length > 0) {
    // Weakest weapon = worst headshot ratio among weapons with meaningful use
    const withHsRatio = weaponEntries.map(([id, w]) => ({
      id,
      name: weaponDisplayName(id),
      kills: w.StatsTotal.Kills,
      hsRatio: pct(w.StatsTotal.HeadShots, w.StatsTotal.Kills),
      level: w.LevelCurrent,
    }));
    withHsRatio.sort((a, b) => a.hsRatio - b.hsRatio);
    const worst = withHsRatio[0];

    // Most-relied-on weapon = highest kill count
    const mostUsed = [...withHsRatio].sort((a, b) => b.kills - a.kills)[0];
    const concentration = pct(
      mostUsed.kills,
      withHsRatio.reduce((sum, w) => sum + w.kills, 0)
    );

    const weaponBadness = Math.round(
      (badnessFromRatio(worst.hsRatio, BENCH.headshotRatio) +
        (concentration > 0.6 ? clamp((concentration - 0.6) * 200, 0, 100) : 0)) /
        2
    );
    badnessScores.push(weaponBadness);

    cards.push({
      id: 'weapons',
      category: 'weapons',
      emoji: weaponBadness >= 60 ? '🔫' : weaponBadness >= 30 ? '🧰' : '🏆',
      title: weaponBadness >= 60 ? 'Spray and Pray' : weaponBadness >= 30 ? 'One-Trick' : 'Arsenal Respected',
      headline: `Worst gun on record: the ${worst.name}, at a ${(worst.hsRatio * 100).toFixed(1)}% headshot rate over ${worst.kills} kills.`,
      body:
        concentration > 0.6
          ? `${(concentration * 100).toFixed(0)}% of all kills come from the ${mostUsed.name} alone — a one-weapon army that falls apart the moment it's not in the loadout.`
          : `Kills are at least spread across the arsenal, so it's not a total one-trick situation — just a rough week for the ${worst.name}.`,
      statLine: `${worst.name}: ${(worst.hsRatio * 100).toFixed(1)}% HS rate · Lv.${worst.level}`,
      severity: (weaponBadness >= 70 ? 5 : weaponBadness >= 45 ? 4 : weaponBadness >= 20 ? 3 : 2) as RoastCard['severity'],
    });
  } else {
    cards.push({
      id: 'weapons-unavailable',
      category: 'weapons',
      emoji: '🧰',
      title: 'Arsenal',
      headline: 'Weapon mastery data unavailable for this player.',
      body: "Either this account doesn't have enough recorded weapon kills yet, or the PUBG API didn't return mastery data for it this time. Everything else in this roast is unaffected.",
      statLine: 'No weapon mastery data returned',
      severity: 1,
    });
  }

  // ── Ranked card (only if the player has ranked data) ────────────────
  if (ranked) {
    const rankedStats = ranked.data.attributes.rankedGameModeStats;
    const rankedEntry = rankedStats.squad ?? rankedStats['squad-fpp'] ?? null;

    if (rankedEntry && rankedEntry.roundsPlayed > 0) {
      const tierIdx = TIER_ORDER.indexOf(rankedEntry.currentTier.tier);
      const tierBadness = tierIdx >= 0 ? Math.round(((TIER_ORDER.length - 1 - tierIdx) / (TIER_ORDER.length - 1)) * 100) : 50;
      const kdaBadness = badnessFromRatio(rankedEntry.kda, BENCH.rankedKDA);
      const rankedBadness = Math.round((tierBadness + kdaBadness) / 2);
      badnessScores.push(rankedBadness);

      cards.push({
        id: 'ranked',
        category: 'ranked',
        emoji: rankedBadness >= 60 ? '📉' : rankedBadness >= 30 ? '📊' : '📈',
        title: `Ranked: ${rankedEntry.currentTier.tier} ${rankedEntry.currentTier.subTier}`,
        headline: `${rankedEntry.wins} ranked wins from ${rankedEntry.roundsPlayed} matches, sitting in ${rankedEntry.currentTier.tier} ${rankedEntry.currentTier.subTier}.`,
        body:
          rankedBadness >= 60
            ? `Best tier ever reached: ${rankedEntry.bestTier.tier} ${rankedEntry.bestTier.subTier}. The current rank is doing a lot of talking about where the climb stalled out.`
            : `A KDA of ${rankedEntry.kda.toFixed(2)} in competitive is nothing to bury — this is someone who queues ranked on purpose.`,
        statLine: `${rankedEntry.currentTier.tier} ${rankedEntry.currentTier.subTier} · ${rankedEntry.kda.toFixed(2)} KDA`,
        severity: (rankedBadness >= 70 ? 5 : rankedBadness >= 45 ? 4 : rankedBadness >= 20 ? 3 : 2) as RoastCard['severity'],
      });
    }
  }

  // ── Maps card — honest placeholder, see README for why ──────────────
  cards.push({
    id: 'maps',
    category: 'maps',
    emoji: '🗺️',
    title: 'Map Breakdown',
    headline: 'Coming soon.',
    body:
      "The PUBG API doesn't expose per-map performance directly — that would mean pulling and parsing individual match telemetry for hundreds of games. Wire up the matches endpoint + telemetry parsing if you want this filled in; the roast engine already has a slot ready for it.",
    statLine: 'Not available from current stats endpoints',
    severity: 1,
  });

  // ── Overall roast score ──────────────────────────────────────────────
  const roastScore = badnessScores.length
    ? Math.round(badnessScores.reduce((a, b) => a + b, 0) / badnessScores.length)
    : 50;

  const roastTitle =
    roastScore >= 80
      ? 'Certified Bot'
      : roastScore >= 60
      ? 'Chicken Dinner Tourist'
      : roastScore >= 40
      ? 'Statistically Average'
      : roastScore >= 20
      ? 'Respectfully Dangerous'
      : 'Actual Menace';

  return {
    playerName,
    platform,
    seasonId,
    mainMode: main.mode,
    roastScore,
    roastTitle,
    cards,
    generatedAt: Date.now(),
    cacheHit: false,
  };
}
