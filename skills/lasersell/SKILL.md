---
name: lasersell
description: AI coding skill for LaserSell covering automated exit strategies (take profit, stop loss, trailing stop), one-shot buys and sells, real-time position monitoring via WebSocket, liquidity snapshots with slippage bands, and transaction signing/submission across Raydium, Pump.fun, PumpSwap, and Meteora on Solana. SDKs in TypeScript, Python, Rust, and Go. Use when building trading bots, AI agents, portfolio tools, or any application that needs to execute trades on Solana DEXs.
---

# LaserSell SDK Development Guide

LaserSell is professional Solana execution infrastructure for automated trade exits. The SDK builds optimized unsigned transactions across Solana DEXs, signs them locally (non-custodial), and submits them via multiple backends.

## Overview

- Build unsigned buy/sell transactions via the LaserSell API with optimized DEX routing
- Exit Intelligence Stream: real-time exit signals with pre-built transactions (take profit, stop loss, trailing stop, deadline timeout, sell on graduation)
- Liquidity snapshots with slippage bands (1%, 2%, 5%, 10%) and trend indicators
- Partial sells based on real-time liquidity data
- Multi-wallet monitoring (up to 200 wallets on Advanced tier)
- Non-custodial: private keys never leave the client
- Multi-language: TypeScript, Python, Rust, Go (all at API parity)
- Supported DEXs: Pump.fun, PumpSwap, Raydium (LaunchLab, CPMM), Meteora (DBC, DAMM v2), Bags.fm

## Install

```bash
npm install @lasersell/lasersell-sdk   # TypeScript
pip install lasersell-sdk              # Python
cargo add lasersell-sdk                # Rust
go get github.com/lasersell/lasersell-sdk/go  # Go
```

Get a free API key at https://app.lasersell.io/auth/sign-up (no credit card required).

## Quick Start: Build and Send a Sell

**TypeScript**

```typescript
import {
  ExitApiClient, signUnsignedTx, sendTransaction, sendTargetDefaultRpc,
} from "@lasersell/lasersell-sdk";

const client = ExitApiClient.withApiKey(process.env.LASERSELL_API_KEY!);
const unsignedTxB64 = await client.buildSellTxB64({
  mint: "TOKEN_MINT_ADDRESS",
  user_pubkey: "YOUR_WALLET_PUBKEY",
  amount_tokens: 1_000_000, // 0 = sell all
  slippage_bps: 2_000,      // 20%
  output: "SOL",             // "SOL" or "USD1"
});
const signedTx = signUnsignedTx(unsignedTxB64, keypair);
const signature = await sendTransaction(sendTargetDefaultRpc(), signedTx);
```

**Python**

```python
from lasersell_sdk.exit_api import ExitApiClient, BuildSellTxRequest, SellOutput
from lasersell_sdk.tx import sign_unsigned_tx, send_transaction, SendTargetRpc

client = ExitApiClient.with_api_key("YOUR_API_KEY")
response = await client.build_sell_tx(BuildSellTxRequest(
    mint="TOKEN_MINT", user_pubkey="WALLET_PUBKEY",
    amount_tokens=1_000_000, slippage_bps=2_000, output=SellOutput.SOL,
))
signed = sign_unsigned_tx(response.tx, keypair)
sig = await send_transaction(SendTargetRpc(), signed)
```

**Rust**

```rust
use lasersell_sdk::exit_api::{ExitApiClient, BuildSellTxRequest, SellOutput};
use lasersell_sdk::tx::{sign_unsigned_tx, send_transaction, SendTarget};

let client = ExitApiClient::with_api_key(SecretString::new(api_key.into()))?;
let response = client.build_sell_tx(&BuildSellTxRequest {
    mint: mint_pubkey, user_pubkey: wallet_pubkey,
    amount_tokens: 1_000_000, slippage_bps: 2_000,
    output: SellOutput::Sol, ..Default::default()
}).await?;
let signed = sign_unsigned_tx(&response.tx, &keypair)?;
let sig = send_transaction(&http, &SendTarget::default_rpc(), &signed).await?;
```

**Go**

```go
client := lasersell.NewExitAPIClientWithAPIKey(apiKey)
response, _ := client.BuildSellTx(ctx, lasersell.BuildSellTxRequest{
    Mint: "TOKEN_MINT", UserPubkey: "WALLET_PUBKEY",
    AmountTokens: 1_000_000, SlippageBps: 2_000,
    Output: lasersell.SellOutputSOL,
})
signed, _ := lasersell.SignUnsignedTx(response.Tx, keypair)
sig, _ := lasersell.SendTransaction(ctx, httpClient, lasersell.SendTargetDefaultRpc(), signed)
```

## Core Concepts

### Architecture

1. Client sends request to the LaserSell API (mint, amount, slippage)
2. API builds an unsigned transaction with optimal DEX routing
3. Client signs locally with their private key
4. Client submits signed transaction to Solana

Private keys never leave the client. The API only receives public keys.

### SDK Modules

| Module | Purpose |
|--------|---------|
| `exit_api` | HTTP client for building unsigned buy/sell transactions |
| `stream` | WebSocket client for real-time position monitoring and exit signals |
| `tx` | Transaction signing and submission |
| `retry` | Exponential backoff with jitter for transient failures |

### Tiers and Limits

| Parameter | Free (Tier 0) | Professional (Tier 1) | Advanced (Tier 2) |
|-----------|---------------|----------------------|-------------------|
| Inactivity timeout | 45 min | 24/7 | 24/7 |
| Wallets per session | 1 | 5 | 200 |
| Positions per wallet | 10 | 100 | 100 |
| Liquidity snapshots | No | Yes | Yes |
| Partner fees | No | No | Yes |

## Building Transactions

### Buy transaction

```typescript
const response = await client.buildBuyTx({
  mint: "TOKEN_MINT",
  user_pubkey: "WALLET_PUBKEY",
  amount: 0.1,          // human-readable SOL (or use amount_in_total for atomic units)
  slippage_bps: 2_000,
  input: "SOL",         // "SOL" or "USD1"
});
```

### Optional fields (buy and sell)

| Field | Type | Description |
|-------|------|-------------|
| `send_mode` | `"rpc"` \| `"helius_sender"` \| `"astralane"` | Submission mode. Default: `"rpc"` |
| `tip_lamports` | `u64` | Priority fee tip. Default: 1,000 (0.001 SOL) |
| `partner_fee_recipient` | `Pubkey` | Fee recipient wallet (Tier 2 only) |
| `partner_fee_bps` | `u16` | Fee in bps, max 50. Exclusive with `partner_fee_lamports` |
| `partner_fee_lamports` | `u64` | Fee in lamports, max 50M. Exclusive with `partner_fee_bps` |

### Partial sell

Sell a subset of tokens instead of the full balance. Use partial sells when the pool cannot absorb your full position without excessive slippage. Pairs with liquidity snapshots to sell exactly what the pool can handle.

```typescript
// TypeScript
const resp = await client.buildPartialSellTx(handle, maxTokens, { slippageBps: 500, output: "SOL" });
```

```python
# Python
resp = await client.build_partial_sell_tx(handle, amount_tokens, slippage_bps=500, output=SellOutput.SOL)
```

```rust
// Rust
let resp = client.build_partial_sell_tx(&handle, amount_tokens, 500, Some(SellOutput::Sol)).await?;
```

```go
// Go
resp, err := client.BuildPartialSellTx(ctx, handle, amountTokens, 500, nil) // nil defaults to SOL
```

### Multi-leg sell

For large positions in thin pools, sell in a loop: check liquidity, sell what fits, wait for the balance update, repeat.

```typescript
let remaining = position.tokens;
while (remaining > 0) {
  const maxTokens = session.getMaxSellAtSlippage(positionId, 500); // 5% slippage cap
  if (!maxTokens || maxTokens === 0) break; // liquidity dried up
  const chunk = Math.min(remaining, maxTokens);
  const { tx } = await client.buildPartialSellTx(handle, chunk, { slippageBps: 500 });
  const signed = signUnsignedTx(tx, keypair);
  await sendTransaction(sendTargetHeliusSender(), signed);
  // Wait for on-chain balance confirmation
  while (true) {
    const ev = await session.recv();
    if (ev === null) return;
    if (ev.type === "message" && ev.message.type === "balance_update"
        && ev.message.mint === handle.mint) {
      remaining = ev.message.tokens;
      break;
    }
  }
}
```

## Exit Intelligence Stream

The stream monitors positions server-side and delivers ready-to-sign exit transactions the instant conditions are met. No polling, no client-side price math.

**Important:** Connect the stream **before** submitting a buy. The stream detects positions by watching on-chain token arrivals.

### Strategy options

At least one must be enabled:

| Condition | Field | Description |
|-----------|-------|-------------|
| Take profit | `target_profit_pct` | Exit at this % gain |
| Stop loss | `stop_loss_pct` | Exit at this % loss |
| Trailing stop | `trailing_stop_pct` | Exit when profit drops this % from peak (only fires after position is in profit) |
| Deadline | `deadline_timeout_sec` | Exit after N seconds regardless of PnL |
| Graduation | `sell_on_graduation` | Exit when token graduates from bonding curve to DEX |

### Connect and receive events

**TypeScript**

```typescript
import {
  StreamClient, StreamSession, signUnsignedTx, sendTransaction, sendTargetHeliusSender,
} from "@lasersell/lasersell-sdk";

const session = await StreamSession.connect(new StreamClient(apiKey), {
  wallet_pubkeys: ["YOUR_WALLET_PUBKEY"],
  strategy: { target_profit_pct: 50, stop_loss_pct: 10, trailing_stop_pct: 5 },
  deadline_timeout_sec: 120,
});

while (true) {
  const event = await session.recv();
  if (event === null) break;
  switch (event.type) {
    case "position_opened":
      console.log("New position:", event.message.mint);
      break;
    case "pnl_update":
      console.log("PnL profit_units:", event.message.profit_units);
      break;
    case "exit_signal_with_tx":
      if (event.message.type === "exit_signal_with_tx") {
        const signed = signUnsignedTx(event.message.unsigned_tx_b64, signer);
        await sendTransaction(sendTargetHeliusSender(), signed);
      }
      break;
    case "position_closed":
      console.log("Closed:", event.message.position_id);
      break;
  }
}
```

**Python**

```python
from lasersell_sdk.stream.client import StreamClient
from lasersell_sdk.stream.session import StreamSession, StreamConfigure
from lasersell_sdk.tx import sign_unsigned_tx, send_transaction, SendTargetHeliusSender

session = await StreamSession.connect(StreamClient(api_key), StreamConfigure(
    wallet_pubkeys=[wallet_pubkey],
    strategy={"target_profit_pct": 50, "stop_loss_pct": 10, "trailing_stop_pct": 5},
    deadline_timeout_sec=120,
))
while True:
    event = await session.recv()
    if event is None: break
    if event.type == "exit_signal_with_tx":
        signed = sign_unsigned_tx(event.message["unsigned_tx_b64"], signer)
        await send_transaction(SendTargetHeliusSender(), signed)
```

**Rust**

```rust
let mut session = StreamSession::connect(&StreamClient::new(api_key), configure).await?;
while let Some(event) = session.recv().await {
    match event {
        StreamEvent::ExitSignalWithTx { message, .. } => {
            let signed = sign_unsigned_tx(&message.unsigned_tx_b64, &keypair)?;
            send_transaction(&http, &SendTarget::HeliusSender, &signed).await?;
        }
        _ => {}
    }
}
```

**Go**

```go
session, _ := stream.ConnectSession(ctx, stream.NewStreamClient(apiKey), configure)
for {
    event, err := session.Recv(ctx)
    if err != nil { break }
    if event.Type == "exit_signal_with_tx" {
        signed, _ := lasersell.SignUnsignedTx(event.Message.UnsignedTxB64, keypair)
        lasersell.SendTransaction(ctx, httpClient, lasersell.SendTargetHeliusSender(), signed)
    }
}
```

### Stream events

| Event | Description |
|-------|-------------|
| `position_opened` | New token position detected |
| `pnl_update` | Profit/loss update |
| `liquidity_snapshot` | Slippage bands + trend (Tier 1+) |
| `balance_update` | Token balance changed |
| `exit_signal_with_tx` | Exit triggered with unsigned transaction |
| `position_closed` | Position closed |

### Mid-session updates

All commands go through `session.sender()`:

```typescript
session.sender().updateWallets(["WALLET_1", "WALLET_2"]);       // replace watched wallets (server diffs)
session.sender().updateStrategy({ target_profit_pct: 100 });     // applies to all current + future positions
session.sender().closeById(positionId);                          // manually close a position
session.sender().requestExitSignalById(positionId);              // trigger exit tx for a position
session.sender().requestExitSignalById(positionId, 500);         // with custom slippage (5%)
```

`closePosition(selector)` and `requestExitSignal(selector, slippageBps?)` accept a `PositionSelectorInput` for matching by mint or wallet instead of ID.

### Liquidity snapshots (Tier 1+)

Delivered via `liquidity_snapshot` events and cached on the session. Each snapshot contains slippage bands showing how many tokens the pool can absorb at 1%, 2%, 5%, and 10% slippage, plus `coverage_pct` (what percentage of your position fits in each band).

```typescript
const bands = session.getSlippageBands(positionId);
// => [{ slippage_bps: 100, max_tokens: 50000, coverage_pct: 12.5 }, ...]
const maxTokens = session.getMaxSellAtSlippage(positionId, 500); // max tokens at 5% slippage
const trend = session.getLiquidityTrend(positionId);
```

Trend values: `"growing"` (liquidity increasing, safe to sell larger chunks), `"stable"` (unchanged), `"draining"` (liquidity leaving the pool, sell sooner or reduce chunk size).

## Transaction Submission

### Send targets

| Target | Constructor (TS) | Best for |
|--------|-------------------|----------|
| Default RPC | `sendTargetDefaultRpc()` | Development (rate-limited) |
| Custom RPC | `sendTargetRpc(url)` | Private RPC endpoint |
| Helius Sender | `sendTargetHeliusSender()` | Production (recommended) |
| Astralane Iris | `sendTargetAstralane(key, region?)` | Multi-region production |

Astralane regions: `fr`, `fr2`, `la`, `jp`, `ny`, `ams`, `ams2`, `lim`, `sg`, `lit`

### Sign and send in one call

```typescript
import { signAndSendUnsignedTxB64 } from "@lasersell/lasersell-sdk";
const sig = await signAndSendUnsignedTxB64(sendTargetHeliusSender(), unsignedTxB64, keypair);
```

## Error Handling

### ExitApiError

| Kind | Retryable | Description |
|------|-----------|-------------|
| `transport` | Yes | Network error (DNS, timeout) |
| `http_status` | Depends | Non-200 HTTP response |
| `envelope_status` | No | API returned error in body |
| `parse` | No | Failed to parse response |

```typescript
try {
  await client.buildSellTx(request);
} catch (error) {
  if (error instanceof ExitApiError && error.isRetryable()) { /* retry */ }
}
```

### Retry

```typescript
import { retryAsync, LOW_LATENCY_RETRY_POLICY, ExitApiError } from "@lasersell/lasersell-sdk";
const result = await retryAsync(
  LOW_LATENCY_RETRY_POLICY,
  () => client.buildSellTx(request),
  (error) => error instanceof ExitApiError && error.isRetryable(),
);
```

## Anti-Patterns

- **Never** send private keys to the API. All signing is local.
- **Never** buy before the stream is connected. Stream detects positions via on-chain token arrivals.
- **Never** use `amount_tokens: 0` on buy requests. Zero means "sell all" on sells only.
- **Never** set `slippage_bps` above 10000. The API rejects it.
- **Never** use the public RPC in production. Use Helius Sender or a private RPC.
- **Never** set both `partner_fee_bps` and `partner_fee_lamports`. They are mutually exclusive.

## Skill Structure

```
lasersell/
├── SKILL.md                                  # This file
├── examples/
│   ├── auto-sell/                            # Stream-based auto-exit (TS, Python, Rust, Go)
│   ├── build-buy/                            # One-shot buy (TS, Python)
│   ├── build-sell/                           # One-shot sell (TS, Python)
│   └── build-and-send-sell/                  # Build, sign, and submit (TS, Python)
├── docs/
│   ├── troubleshooting.md                    # Common errors and solutions
│   ├── ai-agent-integration.md               # Using LaserSell in AI agents
│   └── strategy-guide.md                     # Exit strategy configuration walkthrough
├── templates/
│   ├── auto-exit-bot.ts                      # Copy-paste TypeScript bot template
│   └── auto_exit_bot.py                      # Copy-paste Python bot template
└── resources/
    ├── api-reference.md                      # Full /v1/sell and /v1/buy endpoint docs
    ├── types-reference.md                    # SDK type definitions
    ├── stream-protocol.md                    # WebSocket protocol messages
    └── program-addresses.md                  # Solana program addresses
```

## Resources

### Skill reference files
- [API Reference](resources/api-reference.md)
- [Types Reference](resources/types-reference.md)
- [Stream Protocol Reference](resources/stream-protocol.md)
- [Program Addresses](resources/program-addresses.md)
- [Troubleshooting](docs/troubleshooting.md)
- [AI Agent Integration](docs/ai-agent-integration.md)
- [Strategy Guide](docs/strategy-guide.md)

### External links
- [SDK Repository](https://github.com/lasersell/lasersell-sdk)
- [API Documentation](https://docs.lasersell.io/api/overview)
- [Quickstart Guide](https://docs.lasersell.io/api/quickstart)
- [Strategy Configuration](https://docs.lasersell.io/api/stream/strategy-configuration)
- [Rate Limits and Tiers](https://docs.lasersell.io/api/reference/rate-limits)
- [Benchmark Results](https://www.lasersell.io/blog/benchmark-results)
- [MCP Server](https://docs.lasersell.io/ai-agents/mcp-server) (real-time doc search in your editor)
