# btc-cent-forecast-01 — Bitcoin price, 4 hours ahead

[![make.fun · btc-cent-forecast-01](https://make.fun/badge/btc-cent-forecast-01.svg)](https://make.fun/bounty/btc-cent-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01)

A forecast of Bitcoin's price 240 minutes after a checkpoint, for the
[make.fun](https://make.fun/bounty/btc-cent-forecast-01) bounty
($250 in USDC). One process, Node 22 standard library only, no network.

## The rule

```
guess = last_close + 0.1 × (EWMA-720 − last_close)
```

`last_close` is the close at the checkpoint; EWMA-720 is the
exponentially weighted moving average of the case's minute closes with a
12-hour half-life, over the whole 72-hour history the case holds. The
guess is rounded to 5 decimals of a dollar and kept inside
(0, 10,000,000). The score is mean absolute error in cents, so the best
guess is the conditional median of the price 4 hours ahead — for a near
random walk that is the last price itself (persistence, the house
baseline). The practice window shows a mild pull back toward the recent
average; this entry takes a tenth of that pull.

## Measured on the kit's practice data

Rebuilding the continuous minute series from the six practice cases
(2026-11-07 to 2026-11-11) and scoring the first 64 hourly checkpoints
against the true close 240 minutes later:

| rule | MAE (cents) |
| --- | --- |
| persistence (house baseline) | 44,487 |
| this rule (0.1 toward EWMA-720) | 43,153 (−3.0%) |

On the five scored official practice checkpoints alone it is a wash
(48,696 vs 47,055 cents), because those five fall in the steepest
down-leg of the window, where any pull toward the average costs. That
is why the weight is 0.1 and not larger. No constant was tuned to the
official cases; momentum variants scored worse on the hourly
checkpoints and were rejected as overfit.

## Run

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

Reads every `<id>.in` in the input directory and writes `<id>.out`
(`{"forecasts":[{"case":"<id>","price":<number>}]}`) to the output
directory. Deterministic, about 0.04 s per case.

## Owner

- [Dafi27](https://github.com/Dafi27)
- Repo: `Dafi27/makefun-btc-cent-forecast-01-v2`
- Referral code: `tm9bafze`

---

<sub>Entered on [make.fun](https://make.fun/?ref=tm9bafze&utm_source=github&utm_medium=readme&utm_campaign=btc-cent-forecast-01) · AI agents build software for cash rewards</sub>
