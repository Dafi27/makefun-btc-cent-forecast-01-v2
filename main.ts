// btc-cent-forecast-01 entry (Node 22, standard library only).
//
// Forecast: Bitcoin's price 240 minutes after the checkpoint, in cents
// mean-absolute-error terms, so the best guess is the conditional median
// of the price 4 hours ahead. For a near random walk that median is the
// last price (persistence, the house baseline). The practice window shows
// a mild pull back toward the recent average, so this entry shrinks the
// last price a little toward a slow average:
//
//   guess = x + 0.1 * (ewma720 - x)
//
// x is the close at the checkpoint `at`; ewma720 is the exponentially
// weighted moving average of the case's minute closes with a 12-hour
// half-life (alpha = 1 - 0.5^(1/720) per minute), taken over the whole
// 72-hour history the case holds. The guess is rounded to the price
// grid's 5 decimals of a dollar and kept inside (0, 10,000,000).
//
// Why the weight is only 0.1: the pull is real but regime-dependent.
// On hourly checkpoints rebuilt from the six practice cases it beats
// persistence by about 4%, while on the five scored official practice
// checkpoints it loses a few percent, because those five fall in the
// steepest down-leg of the window, where any pull toward the average
// costs. A tenth of the pull takes the edge without betting on it.
//
// What an entry must do:
//   - read every <id>.in in the input directory (the grader runs one case
//     at a time, with only that case's file there), canonical JSON
//     {"schema":"makefun/btc-cent-case/v1","case","at","horizon_minutes",
//     "markets":[{"id","name","start","prices"}]}, where `prices` holds one
//     close a minute in US dollars per whole BTC from `start` to `at`
//     inclusive, so the last one is the close at the checkpoint;
//   - write <id>.out to the output directory:
//     {"forecasts":[{"case":"<the case's id>","price":<number>}]}, exactly
//     one row naming the case and no other key, its price a finite number
//     greater than 0 and less than 10,000,000, at most 1 MiB. Anything else
//     is an invalid case, scored as if the guess were the checkpoint's own
//     close, and an entry with an invalid case ranks below every valid one
//     and takes no prize.
// It runs offline, with no network, under the case's time cap: everything
// it knows is in the case's prices.
//
// Outside the grader's container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** One unit of the price grid: 5 decimals of a dollar. */
const GRID = 1e5;
/** Scorer's bounds: price must be > 0 and < 10,000,000. */
const MIN_PRICE = 0.00001;
const MAX_PRICE = 9_999_999.99999;
/** Half-life of the slow average, in minutes: 12 hours. */
const HALF_LIFE_MINUTES = 720;
/**
 * How far the guess moves from the last close toward the slow average.
 * 0.1 is the conservative end of the range that beat persistence on the
 * hourly practice checkpoints; larger weights won more there but lost
 * more on the steepest down-leg of the window.
 */
const SHRINKAGE = 0.1;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface CaseFile {
  markets: CaseMarket[];
}

/** Round x onto the 5-decimal grid, inside the scorer's bounds. */
function toGridPrice(x: number): number {
  const clamped = Math.min(MAX_PRICE, Math.max(MIN_PRICE, x));
  return Math.round(clamped * GRID) / GRID;
}

/**
 * Exponentially weighted moving average of a price series, seeded at the
 * first price, one deterministic pass. alpha is per-minute for the given
 * half-life in minutes.
 */
function ewma(prices: number[], halfLifeMinutes: number): number {
  const alpha = 1 - Math.pow(0.5, 1 / halfLifeMinutes);
  let avg = prices[0] as number;
  for (let i = 1; i < prices.length; i += 1) {
    avg = alpha * (prices[i] as number) + (1 - alpha) * avg;
  }
  return avg;
}

/** Forecast for one market: last close shrunk toward its slow average. */
function forecast(market: CaseMarket): number {
  if (!Array.isArray(market.prices) || market.prices.length === 0) {
    throw new Error(`market ${market.id} has no prices`);
  }
  for (const price of market.prices) {
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      throw new Error(`market ${market.id} holds a non-finite price`);
    }
  }
  const last = market.prices[market.prices.length - 1] as number;
  const slow = ewma(market.prices, HALF_LIFE_MINUTES);
  return toGridPrice(last + SHRINKAGE * (slow - last));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Process cases in name order so two runs write identical bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const parsed = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as CaseFile;
  if (!Array.isArray(parsed.markets) || parsed.markets.length !== 1) {
    throw new Error(`${file} does not hold exactly one market`);
  }
  const price = forecast(parsed.markets[0] as CaseMarket);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price }] })}\n`);
}
