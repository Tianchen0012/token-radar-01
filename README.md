# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Tianchen0012/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Tianchen0012/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: a program that reads a sealed DefiLlama snapshot, ranks the 200 pre-token protocols most worth farming by an implied launch value, and writes a dashboard that shows the board, each protocol's model arithmetic and a concrete five-step farm plan. Protocols whose token already trades sit apart in a Live tokens view at the market's own value.

## The model (radar-2)

`implied = TVL × category multiple × growth multiplier × age factor × chain multiplier`

- **TVL × category multiple** — the base. Trading venues and lending markets convert more of their locked value into token value (0.35–0.40) than bridges (0.12–0.15).
- **Growth multiplier** — seven-day TVL growth, clamped to −50%…+150%, weighted 0.6 and bounded to 0.70…1.90.
- **Age factor** — a hump over days listed with no token: 0.85 under 90 days, 1.15 near two years, easing back to 0.80 after four.
- **Chain multiplier** — +2% per chain, up to 10%, for wider distribution.

Every figure comes from the snapshot alone; no protocol name is ever special-cased. The dashboard prints the formula and each row's own numbers, so any value can be checked.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

This writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to `out/`. Open `out/dashboard/index.html` in a browser — it renders with no network.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
