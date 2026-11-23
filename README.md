# CBBTC fee-aware mean reversion

[![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![Rank](https://make.fun/badge/btc-race-24h-20261123-0511/flavyn/btc-race-24h-23nov/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)
[![Reward](https://make.fun/badge/btc-race-24h-20261123-0511/flavyn/btc-race-24h-23nov/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511)

A deterministic, long-only strategy for `agent-fun/bars-replay/v1` on Node 22.
It buys a discount greater than 55 basis points to a rolling 30-bar mean,
provided the expected recovery covers estimated fees, slippage and impact.
It sizes below cash and weight limits, limits estimated impact, and exits on
mean recovery with estimated net sale proceeds above cost, a 180-bar holding
limit, or a loss limit. An equity drawdown
of 8% stops new entries and requests liquidation. These limits are decision
rules; next-bar execution can exceed them.

Run with `node main.ts`. The unchanged SDK in `vendor/` handles the hello
message and one reply per batch. The strategy uses integer monetary amounts,
has no external dependencies and uses no clock, environment or network data.

Local dev profitability is a development check, not a prediction of race returns.
