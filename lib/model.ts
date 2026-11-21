// The token radar's model, version radar-2: one snapshot of the protocol universe in,
// one ranked board out. Written from scratch for this entry; it shares no line with the
// kit starter's model.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and
// adds the 160 pre-token protocols below the floor with the most TVL. A protocol is
// pre-token when its record carries no token at all (no market cap, no CoinGecko id, no
// symbol). Protocols whose token already trades are kept apart in a separate live set and
// shown at the market's own value, never ranked by implied value.
//
// Implied value follows only from the snapshot's own figures — TVL, seven-day TVL growth,
// days listed with no token, category and chain count. No protocol name is ever
// special-cased: the same function scores every row.
//
//   base         = tvl_usd x categoryMultiple(category)
//   growthMult   = clamp(1 + clamp(change_7d, -50, 150) / 100 x 0.6, 0.70, 1.90)
//   ageFactor    = a hump over days listed with no token (see ageFactor):
//                  0.85 young, rising to 1.15 at about two years, easing back to 0.80
//                  for the oldest listings; 0.95 when listed_at is unreported
//   chainMult    = 1 + 0.02 x min(chains.length, 5)   (wider distribution, up to 1.10)
//   implied      = max(1, round(base x growthMult x ageFactor x chainMult))
//
// Why these shapes. A token launch is priced off the value already locked in the protocol,
// so TVL is the base; the category multiple says how much of that locked value a launch
// typically turns into token value — trading and lending venues convert more of their TVL
// than bridges, which mostly move other people's assets. Growth says the protocol is
// gaining users now, so a launch lands on a rising curve; the clamp keeps one hot week
// from dominating the board. Age is a hump, not a slope: a protocol that has run for
// months with no token has had time to build the user base a launch rewards, and one
// that has run for years with no token is less likely to launch at all, so the factor
// peaks near two years and falls away. More chains means more places a token can be
// farmed, so a small bonus per chain. Every constant is in MODEL below and the dashboard
// prints the formula with each row's own numbers, so a reader can check any value.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  growth_mult_floor: number;
  growth_mult_cap: number;
  age_young_days: number;
  age_young_factor: number;
  age_peak_days: number;
  age_peak_factor: number;
  age_old_days: number;
  age_old_factor: number;
  unknown_age_factor: number;
  chain_bonus: number;
  chain_bonus_max: number;
  default_multiple: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  growth_mult_floor: 0.7,
  growth_mult_cap: 1.9,
  age_young_days: 90,
  age_young_factor: 0.85,
  age_peak_days: 730,
  age_peak_factor: 1.15,
  age_old_days: 1460,
  age_old_factor: 0.8,
  unknown_age_factor: 0.95,
  chain_bonus: 0.02,
  chain_bonus_max: 5,
  default_multiple: 0.25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    base_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    age_factor: number;
    chain_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  base_usd: number;
  growth_multiplier: number;
  age_factor: number;
  chain_multiplier: number;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  formula: string;
  watchlist_size: number;
  watchlist: string[];
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The formula in one line, for the dashboard's model card. */
export const FORMULA =
  'implied = TVL x category multiple x growth multiplier x age factor x chain multiplier';

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * How much of a protocol's TVL a launch turns into token value, by its DefiLlama
 * category. Trading venues and lending markets convert the most; bridges and staked
 * products move or wrap other assets, so they convert the least. Unlisted categories
 * take the default. The table is keyed by category string only — never by name.
 */
export function categoryMultiple(category: string | null): number {
  const table: Record<string, number> = {
    Dexs: 0.35,
    Lending: 0.35,
    Derivatives: 0.4,
    Perpetuals: 0.4,
    Options: 0.35,
    'Prediction Market': 0.35,
    CDP: 0.3,
    Yield: 0.3,
    'Yield Aggregator': 0.3,
    'Leveraged Farming': 0.3,
    'Liquidity Manager': 0.3,
    RWA: 0.3,
    'Uncollateralized Lending': 0.3,
    Synthetics: 0.3,
    'NFT Marketplace': 0.3,
    Gaming: 0.3,
    'Risk Curators': 0.25,
    'Onchain Capital Allocator': 0.25,
    Insurance: 0.25,
    Social: 0.25,
    Payments: 0.25,
    'Algo-Stables': 0.25,
    Privacy: 0.25,
    Indexes: 0.25,
    Services: 0.2,
    Wallet: 0.25,
    'Liquid Staking': 0.2,
    'Liquid Restaking': 0.2,
    Staking: 0.2,
    'Anchor BTC': 0.2,
    'Reserve Currency': 0.2,
    'Cross Chain': 0.2,
    Bridge: 0.15,
    'Canonical Bridge': 0.12,
    'Restaked BTC': 0.15,
  };
  if (category === null) return MODEL.default_multiple;
  return table[category] ?? MODEL.default_multiple;
}

/**
 * The age factor: a hump over days listed with no token. Young listings start at 0.85
 * and climb to 1.00 at one year and 1.15 at two years, then ease back toward 0.80 for
 * listings older than four years — a launch is most valuable once the protocol has had
 * time to build users, and less likely the longer it has gone without one.
 */
export function ageFactor(age: number | null, model: ModelConstants = MODEL): number {
  if (age === null) return model.unknown_age_factor;
  const a = Math.max(0, age);
  if (a < model.age_young_days) return model.age_young_factor;
  if (a < 365) {
    return model.age_young_factor + ((a - model.age_young_days) / (365 - model.age_young_days)) * (1 - model.age_young_factor);
  }
  if (a < model.age_peak_days) {
    return 1 + ((a - 365) / (model.age_peak_days - 365)) * (model.age_peak_factor - 1);
  }
  if (a < model.age_old_days) {
    return model.age_peak_factor - ((a - model.age_peak_days) / (model.age_old_days - model.age_peak_days)) * (model.age_peak_factor - 1);
  }
  return Math.max(model.age_old_factor, 1 - ((a - model.age_old_days) / model.age_old_days) * (1 - model.age_old_factor));
}

/** The four multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants = MODEL,
): { implied: number; catMult: number; base: number; growthPct: number; growthMult: number; ageF: number; chainMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const catMult = categoryMultiple(protocol.category);
  const base = protocol.tvl_usd * catMult;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = Math.min(model.growth_mult_cap, Math.max(model.growth_mult_floor, 1 + (growthPct / 100) * model.growth_weight));
  const ageF = ageFactor(age, model);
  const chainMult = 1 + model.chain_bonus * Math.min(protocol.chains.length, model.chain_bonus_max);
  const implied = Math.max(1, Math.round(base * growthMult * ageF * chainMult));
  return { implied, catMult, base: Math.round(base), growthPct, growthMult, ageF, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking is a product of a token that trades. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;

/** An exchange's own name at the start of a protocol name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not a centralised exchange,
 * not a versioned pool, and not a wrapped or staked product of a token that already
 * trades. Bridges and liquid-staking protocols stay rankable — their records carry no
 * token of their own — and the dashboard names their category plainly.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    p.category !== 'CEX' &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_OR_STAKED.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug on it is ranked, whatever its figures.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor, by TVL,
  // capped at EARLY_ROWS. Never a replacement for a watchlist row.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: s.catMult,
      base_usd: s.base,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      age_factor: round4(s.ageF),
      chain_multiplier: round4(s.chainMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger listings get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  return 45;
}

/** How often to act, from the protocol's age: younger listings reward more frequent activity. */
function cadenceFor(age: number | null): string {
  if (age === null) return 'twice a week';
  if (age < 180) return 'three times a week';
  if (age < 365) return 'twice a week';
  return 'once a week';
}

/**
 * The core on-protocol action, by category, in the words a farmer can follow. The
 * capital, chain and protocol name come from the protocol's own record; the action
 * follows its category, so a lending market is farmed by supplying and a DEX by
 * providing liquidity, not the other way round.
 */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): { text: string; cost: string; time: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      text: `Supply $${capital} of USDC to ${name} on ${chain}, then borrow $20 of the same asset against it and repay it a week later so the position shows both sides of the market.`,
      cost: `$${capital} of capital plus about $6 of gas for the supply and the borrow`,
      time: '20 minutes to set up, 10 minutes for the repay',
    };
  }
  if (c.includes('dex') || c.includes('leveraged farm') || c.includes('liquidity manager')) {
    return {
      text: `Provide $${capital} of liquidity to ${name}'s most active pool on ${chain} (USDC paired with the chain's native asset), in a narrow range if it offers one, and leave it earning fees.`,
      cost: `$${capital} of capital plus about $5 of gas and the pool's swap fee`,
      time: '20 minutes to set up',
    };
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator')) {
    return {
      text: `Deposit $${capital} of USDC into the highest-TVL ${name} vault on ${chain} and keep the vault shares; do not chase the vault with the highest advertised yield.`,
      cost: `$${capital} of capital plus about $4 of gas`,
      time: '15 minutes to set up',
    };
  }
  if (c.includes('bridge')) {
    return {
      text: `Bridge $${capital} of USDC to ${chain} through ${name}'s official bridge, then use the bridged funds once inside ${chain}'s own apps so the trip is not a round trip.`,
      cost: `$${capital} of capital plus about $3 of gas and the bridge fee`,
      time: '15 minutes, plus the bridge wait',
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      text: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token in the same wallet; unstake nothing until you have read the protocol's own unbonding terms.`,
      cost: `$${capital} of capital plus about $3 of gas`,
      time: '15 minutes to set up',
    };
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return {
      text: `Deposit $${capital} of USDC as margin on ${name} on ${chain}, open one small position hedged against an equal spot holding, and close it the same day so the cost stays a fee, not a loss.`,
      cost: `$${capital} of margin plus about $4 of gas and the trading fee`,
      time: '20 minutes to set up',
    };
  }
  if (c.includes('prediction')) {
    return {
      text: `Fund $${capital} on ${name} on ${chain} and take one small position in a market that settles within the month, so the position is closed and counted before the next snapshot.`,
      cost: `$${capital} of capital plus about $2 of gas`,
      time: '15 minutes to set up',
    };
  }
  if (c.includes('stable')) {
    return {
      text: `Mint $${capital} of the stable asset through ${name} on ${chain} against USDC collateral, hold the minted asset in the same wallet, and keep the collateral ratio above the protocol's minimum.`,
      cost: `$${capital} of collateral plus about $4 of gas`,
      time: '15 minutes to set up',
    };
  }
  if (c.includes('rwa')) {
    return {
      text: `Mint $${capital} of the protocol's yield-bearing asset on ${chain} through ${name} and hold it in the farming wallet so the yield accrues to the address that farmed it.`,
      cost: `$${capital} of capital plus about $4 of gas`,
      time: '15 minutes to set up',
    };
  }
  if (c.includes('insurance')) {
    return {
      text: `Buy $${capital} of cover from ${name} on ${chain} for a protocol you already use, and keep the policy active through the whole farming window.`,
      cost: `$${capital} of premium plus about $3 of gas`,
      time: '15 minutes to set up',
    };
  }
  return {
    text: `Deposit $${capital} of USDC into ${name} on ${chain} through its own app, and keep the position open rather than moving it between wallets.`,
    cost: `$${capital} of capital plus about $4 of gas`,
    time: '15 minutes to set up',
  };
}

/**
 * A protocol's farm plan: five steps, each an action with a cost and a time. Every step
 * is derived from the protocol's own record (category, chains, TVL, age), never from a
 * hand-written list of names, and the second step is the category's own action.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const cadence = cadenceFor(age);
  const core = actionFor(p, capital, chain);
  const otherChain = p.chains.length > 1 ? p.chains[1]! : null;
  return [
    {
      text: `Set up a fresh wallet that holds only the $${capital} you plan to farm, keep its seed phrase offline, and bridge the funds to ${chain} through the chain's official bridge.`,
      cost: `about $3 of gas for the bridge`,
      time: '10 minutes, plus the bridge wait',
    },
    core,
    {
      text: `Repeat one qualifying action ${cadence} — a deposit, a swap, a borrow or a vote — from the same wallet, so the activity reads as a real user and not a single deposit.${otherChain === null ? '' : ` Once, do the same action on ${otherChain} so the second chain counts too.`}`,
      cost: 'about $2 of gas each time',
      time: '10 minutes each time',
    },
    {
      text: `Hold the position for at least ${hold} days, then open the protocol's own points or rewards page from the link it publishes and check what the wallet has earned; claim only from that link and never pay a fee to claim.`,
      cost: `the $${capital} stays in the position, and checking costs nothing`,
      time: `${hold} days of holding, 10 minutes to check`,
    },
    {
      text: `Write the wallet address, the dates and every transaction hash in a farm log, and unwind in the reverse order you entered — close the position, then bridge the funds back — so nothing is left in a wallet you stop watching.`,
      cost: 'about $3 of gas to unwind',
      time: '10 minutes to log, 15 minutes to unwind',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    base_usd: row.model.base_usd,
    growth_multiplier: row.model.growth_multiplier,
    age_factor: row.model.age_factor,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    formula: FORMULA,
    watchlist_size: snapshot.watchlist.length,
    watchlist: snapshot.watchlist,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  if (board.length < 100) return `the board holds ${board.length} rows, fewer than 100`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
