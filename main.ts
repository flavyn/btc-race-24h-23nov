import { runBars } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const BPS = 10_000n;
const LOOKBACK = 30;
const ENTRY_BPS = 55n;
const MAX_HOLD_BARS = 180;
const history: bigint[] = [];
let sum = 0n;
let entrySeq: number | null = null;
let exitRequested = false;
let lastExit = -30;
let peakEquity = 0n;
let halted = false;

await runBars({
  onBatch(state, batch) {
    // Fills, rather than submitted orders, establish the holding period.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL || fill.status !== 'filled') continue;
      // fill_bar is a timestamp; holding periods use the replay sequence.
      if (fill.side === 'buy') entrySeq = batch.seq;
      else {
        entrySeq = null;
        exitRequested = false;
        lastExit = batch.seq;
      }
    }

    if (!batch.bars.some((bar) => bar.symbol === SYMBOL)) return [];
    const price = state.close(SYMBOL);
    if (price === null || price <= 0n) return [];
    history.push(price);
    sum += price;
    if (history.length > LOOKBACK) sum -= history.shift()!;
    if (state.warmingUp || history.length < LOOKBACK) return [];

    if (state.equity > peakEquity) peakEquity = state.equity;
    if (state.equity * BPS < peakEquity * 9_200n) halted = true;
    const mean = sum / BigInt(history.length);
    const position = state.positions.get(SYMBOL);
    if (position && position.qty > 0n) {
      if (entrySeq === null) entrySeq = batch.seq;
      const mark = state.value(SYMBOL, position.qty);
      const exitImpact = state.impactBps(SYMBOL, mark) ?? BPS;
      const exitCosts = BigInt(state.hello.fees.slippage_bps) + exitImpact + 1n;
      const netSale = mark * (BPS - BigInt(state.hello.fees.fee_bps)) / (BPS + exitCosts);
      const recovered = price >= mean && netSale * BPS >= position.cost * 10_005n;
      const timedOut = batch.seq - entrySeq >= MAX_HOLD_BARS;
      const stopped = mark * BPS < position.cost * 9_850n;
      if (recovered || timedOut || stopped || halted || exitRequested) {
        exitRequested = true;
        return [{
          side: 'sell', symbol: SYMBOL, qty: position.qty,
          max_slippage_bps: 100, client_id: state.clientId(),
        }];
      }
      return [];
    }

    if (halted || batch.seq - lastExit < 15 || state.positions.size > 0
      || state.hello.caps.max_open_positions < 1 || state.hello.caps.max_orders_per_bar < 1) return [];
    const depths = state.depthAt(SYMBOL);
    if (!depths || depths.length === 0 || depths.some((depth) => depth <= 0n)) return [];
    let spend = state.cash * 6n / 10n;
    const room = state.weightRoom(SYMBOL) * 99n / 100n;
    if (spend > room) spend = room;
    // Bound the impact of a fill using the latest available pool depth.
    while (spend > 0n && (state.impactBps(SYMBOL, spend) ?? BPS) > 5n) spend /= 2n;
    if (spend < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const impact = state.impactBps(SYMBOL, spend) ?? BPS;
    const roundTrip = 2n * (BigInt(state.hello.fees.fee_bps)
      + BigInt(state.hello.fees.slippage_bps) + impact + 1n);
    const required = roundTrip + 10n > ENTRY_BPS ? roundTrip + 10n : ENTRY_BPS;
    if ((mean - price) * BPS <= mean * required) return [];
    return [{
      side: 'buy', symbol: SYMBOL, notional_quote_units: spend,
      max_slippage_bps: 50, client_id: state.clientId(),
    }];
  },
});
