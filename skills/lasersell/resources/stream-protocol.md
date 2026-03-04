# LaserSell Stream Protocol Reference

WebSocket endpoint: `wss://stream.lasersell.io/v1/ws`

## Connection Flow

1. Client opens WebSocket connection with `x-api-key` header
2. Server sends `hello_ok` message
3. Client sends `configure` message with wallet list and strategy
4. Server begins sending events for tracked positions

## Client Messages

### configure

Sent once after connection. Sets up wallets and strategy.

```json
{
  "type": "configure",
  "wallet_pubkeys": ["WALLET_PUBKEY_1"],
  "strategy": {
    "target_profit_pct": 50,
    "stop_loss_pct": 10,
    "trailing_stop_pct": 5
  },
  "deadline_timeout_sec": 120
}
```

### update_strategy

Change exit strategy mid-session. Applies to all current and future positions.

```json
{
  "type": "update_strategy",
  "strategy": {
    "target_profit_pct": 100,
    "stop_loss_pct": 20,
    "trailing_stop_pct": 10
  }
}
```

### update_wallets

Replace the watched wallet set. Server diffs new list against current. Positions on removed wallets continue tracking until closed.

```json
{
  "type": "update_wallets",
  "wallet_pubkeys": ["WALLET_1", "WALLET_2"]
}
```

### close_position

Manually request position closure.

```json
{
  "type": "close_position",
  "position_id": "POSITION_ID"
}
```

### request_exit_signal

Manually request an exit signal with transaction for a position.

```json
{
  "type": "request_exit_signal",
  "position_id": "POSITION_ID"
}
```

### ping

Keepalive. Server responds with `pong`.

```json
{
  "type": "ping"
}
```

## Server Messages

### hello_ok

Sent immediately after connection. Confirms authentication.

```json
{
  "type": "hello_ok"
}
```

### position_opened

New token position detected in a watched wallet.

```json
{
  "type": "position_opened",
  "position_id": 42,
  "wallet_pubkey": "PUBKEY",
  "mint": "PUBKEY",
  "token_account": "PUBKEY",
  "token_program": "PUBKEY",
  "tokens": 1000000,
  "entry_quote_units": 50000000,
  "market_context": { "market_type": "pumpfun" },
  "slot": 290000000
}
```

### pnl_update

Profit/loss update for a tracked position.

```json
{
  "type": "pnl_update",
  "position_id": 42,
  "profit_units": 6250000,
  "proceeds_units": 56250000,
  "server_time_ms": 1709000000000
}
```

### liquidity_snapshot

Real-time liquidity data. Tier 1+ only.

```json
{
  "type": "liquidity_snapshot",
  "position_id": 42,
  "bands": [
    { "slippage_bps": 100, "max_tokens": 50000, "coverage_pct": 12.5 },
    { "slippage_bps": 200, "max_tokens": 120000, "coverage_pct": 30.0 },
    { "slippage_bps": 500, "max_tokens": 350000, "coverage_pct": 87.5 },
    { "slippage_bps": 1000, "max_tokens": 800000, "coverage_pct": 100.0 }
  ],
  "liquidity_trend": "growing",
  "server_time_ms": 1709000000000
}
```

Trend values: `"growing"`, `"stable"`, `"draining"`

### balance_update

Token balance changed (deposit, partial sell, or external transfer).

```json
{
  "type": "balance_update",
  "wallet_pubkey": "PUBKEY",
  "mint": "PUBKEY",
  "token_account": "PUBKEY",
  "token_program": "PUBKEY",
  "tokens": 500000,
  "slot": 290000000
}
```

### exit_signal_with_tx

Exit condition met. Contains a ready-to-sign transaction.

```json
{
  "type": "exit_signal_with_tx",
  "session_id": 1,
  "position_id": 42,
  "wallet_pubkey": "PUBKEY",
  "mint": "PUBKEY",
  "token_account": "PUBKEY",
  "token_program": "PUBKEY",
  "position_tokens": 1000000,
  "reason": "take_profit",
  "profit_units": 6250000,
  "unsigned_tx_b64": "BASE64_ENCODED_UNSIGNED_TX",
  "triggered_at_ms": 1709000000000,
  "market_context": { "market_type": "pumpswap", "pool_id": "PUBKEY" }
}
```

Reason values: `"take_profit"`, `"stop_loss"`, `"trailing_stop"`, `"deadline_timeout"`, `"sell_on_graduation"`, `"manual"`

### position_closed

Position has been fully exited.

```json
{
  "type": "position_closed",
  "position_id": 42,
  "wallet_pubkey": "PUBKEY",
  "mint": "PUBKEY",
  "token_account": "PUBKEY",
  "reason": "take_profit",
  "slot": 290000000
}
```

### error

Protocol or validation error.

```json
{
  "type": "error",
  "code": "invalid_strategy",
  "message": "At least one exit condition must be enabled"
}
```

### pong

Response to client `ping`.

```json
{
  "type": "pong"
}
```
