# Strategy Configuration Guide

Detailed walkthrough of LaserSell exit strategies and how to configure them.

## Exit Conditions

### Take Profit (`target_profit_pct`)

Fires when the position's unrealized profit reaches the specified percentage of entry cost.

**Example:** Entry cost = 1 SOL, `target_profit_pct: 50` fires when position is worth 1.5 SOL.

**When to use:** You have a fixed profit target and want to exit automatically when it's reached.

### Stop Loss (`stop_loss_pct`)

Fires when the position's unrealized loss reaches the specified percentage of entry cost.

**Example:** Entry cost = 1 SOL, `stop_loss_pct: 10` fires when position is worth 0.9 SOL.

**When to use:** You want to limit downside risk. Recommended on every trade.

### Trailing Stop (`trailing_stop_pct`)

Tracks a high-water mark of the position's profit. Fires when profit drops by the specified percentage from its peak.

**Important behavior:**
- Only fires after the position has been in profit (peak > 0).
- Does NOT fire on positions that have only gone down.
- Resets the high-water mark on each new peak.

**Example:** Entry = 1 SOL, `trailing_stop_pct: 5`
1. Price rises, position worth 1.3 SOL (profit peaks at 0.3 SOL)
2. Price drops, position worth 1.27 SOL (profit = 0.27 SOL, peak was 0.3 SOL, drop = 0.03 SOL = 3%)
3. Price drops more, position worth 1.25 SOL (profit = 0.25 SOL, drop = 0.05 SOL = 5%) -> EXIT

**When to use:** During pumps where you want to ride the wave but lock in gains. Combine with `target_profit_pct` for a guaranteed exit at a fixed level.

### Deadline Timeout (`deadline_timeout_sec`)

Fires after the specified number of seconds regardless of PnL. Set to 0 to disable.

**When to use:** Short-term scalping. Prevents positions from sitting idle indefinitely on the free tier's 45-minute timeout.

### Sell on Graduation (`sell_on_graduation`)

Fires when a token graduates from a bonding curve to a full DEX pool. Currently applies to Pump.fun tokens graduating to PumpSwap.

**When to use:** Tokens that reach graduation often experience a brief spike followed by a sell-off. This catches the graduation event and exits immediately.

## Common Strategy Combinations

### Conservative Scalp
```json
{
  "target_profit_pct": 10,
  "stop_loss_pct": 5,
  "deadline_timeout_sec": 60
}
```
Quick in and out. 10% target, 5% max loss, 60 second maximum hold time.

### Ride the Pump
```json
{
  "target_profit_pct": 100,
  "stop_loss_pct": 15,
  "trailing_stop_pct": 10
}
```
Let winners run with trailing stop. Exit at 100% profit or when profit drops 10% from peak. Hard stop at 15% loss.

### Graduation Play
```json
{
  "stop_loss_pct": 20,
  "sell_on_graduation": true,
  "deadline_timeout_sec": 300
}
```
Buy early Pump.fun tokens, exit on graduation event. Stop loss for protection. 5 minute timeout as a safety net.

### Set and Forget
```json
{
  "target_profit_pct": 50,
  "stop_loss_pct": 10,
  "trailing_stop_pct": 5
}
```
Standard strategy. Take profit at 50%, stop loss at 10%, trailing stop locks in gains above breakeven.

## Updating Strategy Mid-Session

You can change the strategy without reconnecting:

```typescript
session.sender().updateStrategy({
  target_profit_pct: 200,  // raise profit target
  stop_loss_pct: 20,       // widen stop loss
  trailing_stop_pct: 15,   // wider trailing stop
});
```

The new strategy applies to all current and future positions immediately.

## Entry Cost and PnL Calculation

PnL reflects the actual value you would receive if you sold right now, accounting for slippage. It updates in real time.

The entry cost (`entry_quote_units`) is captured when the stream first detects the position's token arrival on-chain.

## Liquidity-Aware Selling

### Why multi-leg sells

Large positions in thin pools cause excessive slippage when sold all at once. A position worth 10 SOL in a pool with 5 SOL of depth at 5% slippage will lose far more than 5% if you dump everything in one transaction. Multi-leg selling breaks the exit into smaller chunks that the pool can absorb.

### Slippage bands

Each `liquidity_snapshot` event includes four slippage bands (1%, 2%, 5%, 10%). Each band reports:

- `max_tokens`: how many tokens the pool can absorb at that slippage level
- `coverage_pct`: what percentage of your current position fits in that band

For example, if you hold 1,000,000 tokens and the 5% band shows `coverage_pct: 35`, you can sell 350,000 tokens (35% of your position) with at most 5% slippage.

### Liquidity trend

The `trend` field on each snapshot tells you how pool liquidity is changing:

| Trend | Meaning | Action |
|-------|---------|--------|
| `growing` | Liquidity increasing | Safe to wait or sell larger chunks |
| `stable` | No significant change | Proceed normally |
| `draining` | Liquidity leaving the pool | Sell sooner, use smaller chunks |

### Complete multi-leg sell example

```typescript
import {
  ExitApiClient, StreamClient, StreamSession,
  signUnsignedTx, sendTransaction, sendTargetHeliusSender,
} from "@lasersell/lasersell-sdk";

const client = ExitApiClient.withApiKey(apiKey);

// Inside your event loop, after receiving a position you want to exit:
async function multiLegSell(
  session: StreamSession,
  positionId: number,
  handle: PositionHandle,
  initialTokens: number,
  keypair: Keypair,
) {
  let remaining = initialTokens;

  while (remaining > 0) {
    // 1. Check how much the pool can absorb at 5% slippage
    const maxTokens = session.getMaxSellAtSlippage(positionId, 500);
    if (!maxTokens || maxTokens === 0) {
      console.log("Pool cannot absorb more tokens, pausing");
      break;
    }

    // 2. Optionally check trend and adjust
    const trend = session.getLiquidityTrend(positionId);
    const chunk = trend === "draining"
      ? Math.min(remaining, Math.floor(maxTokens * 0.5)) // sell half the max if draining
      : Math.min(remaining, maxTokens);

    // 3. Build, sign, and send partial sell
    const { tx } = await client.buildPartialSellTx(handle, chunk, { slippageBps: 500 });
    const signed = signUnsignedTx(tx, keypair);
    await sendTransaction(sendTargetHeliusSender(), signed);

    // 4. Wait for on-chain confirmation via balance_update event
    while (true) {
      const ev = await session.recv();
      if (ev === null) return; // stream closed
      if (ev.type === "message" && ev.message.type === "balance_update"
          && ev.message.mint === handle.mint) {
        remaining = ev.message.tokens;
        console.log(`Sold chunk, ${remaining} tokens remaining`);
        break;
      }
    }
  }
}
```

Key points:
- Always read `maxTokens` from the latest snapshot before each leg, since pool state changes between sells
- Loop on `session.recv()` and wait for the `balance_update` event to confirm the previous sell landed before building the next transaction
- If `trend` is `"draining"`, consider selling smaller chunks or exiting faster
- If `maxTokens` returns 0 or undefined, liquidity has dried up; wait for it to recover or accept remaining exposure
