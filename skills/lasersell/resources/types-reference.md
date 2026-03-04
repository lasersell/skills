# LaserSell SDK Types Reference

## LaserSell API Types

### BuildSellTxRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | `string` (Pubkey) | Yes | Token mint address |
| `user_pubkey` | `string` (Pubkey) | Yes | User's wallet public key |
| `amount_tokens` | `u64` | Yes | Token amount to sell. `0` = sell entire balance |
| `slippage_bps` | `u16` | Yes | Slippage tolerance in basis points (100 = 1%). Max: 10000 |
| `output` | `"SOL"` \| `"USD1"` | Yes | Output asset |
| `send_mode` | `"rpc"` \| `"helius_sender"` \| `"astralane"` | No | Transaction submission mode. Default: `"rpc"` |
| `tip_lamports` | `u64` | No | Priority fee tip. Default: 1000 (0.001 SOL) |
| `partner_fee_recipient` | `string` (Pubkey) | No | Fee recipient wallet (Tier 2 only) |
| `partner_fee_bps` | `u16` | No | Fee in basis points. Max: 50. Exclusive with `partner_fee_lamports` |
| `partner_fee_lamports` | `u64` | No | Fee in lamports. Max: 50,000,000. Exclusive with `partner_fee_bps` |

### BuildBuyTxRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | `string` (Pubkey) | Yes | Token mint address |
| `user_pubkey` | `string` (Pubkey) | Yes | User's wallet public key |
| `amount` | `f64` | One of | Human-readable input amount (e.g., `0.1` SOL) |
| `amount_in_total` | `u64` | One of | Atomic input amount (e.g., `100000000` lamports) |
| `slippage_bps` | `u16` | Yes | Slippage tolerance in basis points. Max: 10000 |
| `input` | `"SOL"` \| `"USD1"` | Yes | Input asset |
| `send_mode` | `"rpc"` \| `"helius_sender"` \| `"astralane"` | No | Transaction submission mode |
| `tip_lamports` | `u64` | No | Priority fee tip |
| `partner_fee_recipient` | `string` (Pubkey) | No | Fee recipient wallet (Tier 2 only) |
| `partner_fee_bps` | `u16` | No | Fee in basis points. Max: 50 |
| `partner_fee_lamports` | `u64` | No | Fee in lamports. Max: 50,000,000 |

### BuildTxResponse

| Field | Type | Description |
|-------|------|-------------|
| `tx` | `string` | Base64-encoded unsigned transaction (bincode serialized) |
| `route` | `RouteInfo` | Routing metadata |
| `route.market_type` | `string` | DEX used (see Market Types) |
| `route.pool_id` | `string?` | Pool address (when applicable) |

### Market Types

| Value | DEX |
|-------|-----|
| `pumpfun` | Pump.fun (bonding curve) |
| `pumpswap` | PumpSwap (post-graduation) |
| `raydium_launchpad` | Raydium LaunchLab |
| `raydium_cpmm` | Raydium CPMM (constant product) |
| `meteora_dbc` | Meteora Dynamic Bonding Curve |
| `meteora_damm_v2` | Meteora Dynamic AMM v2 |

## Stream Types

### StreamConfigure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_pubkeys` | `string[]` | Yes | Wallet public keys to monitor |
| `strategy` | `StrategyConfigMsg` | Yes | Exit strategy configuration |
| `deadline_timeout_sec` | `u64` | No | Seconds before forced exit. `0` = disabled |

### StrategyConfigMsg

All fields are optional but at least one must be set:

| Field | Type | Description |
|-------|------|-------------|
| `target_profit_pct` | `f64` | Take profit at this % gain |
| `stop_loss_pct` | `f64` | Stop loss at this % loss |
| `trailing_stop_pct` | `f64` | Exit when profit drops this % from peak |
| `sell_on_graduation` | `bool` | Exit on bonding curve graduation |

### PositionHandle

Available on every stream event. Identifies the position and provides context for partial sell requests.

| Field | Type | Description |
|-------|------|-------------|
| `position_id` | `u64` | Unique position identifier |
| `token_account` | `string` | Token account address |
| `wallet_pubkey` | `string` | Owning wallet |
| `mint` | `string` | Token mint |
| `token_program` | `string` | Token program ID |
| `tokens` | `u64` | Current token balance |
| `entry_quote_units` | `u64` | Entry cost in quote units |

### SendTarget

| Variant | Constructor (TypeScript) | Description |
|---------|--------------------------|-------------|
| Default RPC | `sendTargetDefaultRpc()` | Public Solana mainnet RPC (rate-limited) |
| Custom RPC | `sendTargetRpc(url)` | Any Solana RPC endpoint |
| Helius Sender | `sendTargetHeliusSender()` | Helius `/fast` endpoint |
| Astralane Iris | `sendTargetAstralane(apiKey, region?)` | Multi-region gateway |

### ExitApiError

| Property | Type | Description |
|----------|------|-------------|
| `kind` | `"transport"` \| `"http_status"` \| `"envelope_status"` \| `"parse"` | Error category |
| `status` | `number?` | HTTP status code (for `http_status`) |
| `body` | `string?` | Response body |
| `detail` | `string` | Human-readable error message |
| `isRetryable()` | `boolean` | Whether the error is transient and safe to retry |

### TxSubmitError

| Property | Type | Description |
|----------|------|-------------|
| `kind` | `string` | Error category (see values below) |
| `target` | `SendTarget?` | The send target that failed |
| `status` | `number?` | HTTP status code |
| `body` | `string?` | Response body |
| `detail` | `string` | Human-readable error message |

Kind values: `decode_unsigned_tx`, `deserialize_unsigned_tx`, `sign_tx`, `serialize_tx`, `request_send`, `response_read`, `http_status`, `decode_response`, `rpc_error`, `missing_result`

### RetryPolicy

| Field | Type | Default |
|-------|------|---------|
| `max_attempts` | `number` | 3 |
| `initial_backoff_ms` | `number` | 100 |
| `max_backoff_ms` | `number` | 1000 |
| `jitter_ms` | `number` | 50 |

`LOW_LATENCY_RETRY_POLICY` provides sensible defaults for trading use cases.
