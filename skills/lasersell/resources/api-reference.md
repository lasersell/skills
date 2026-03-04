# LaserSell API Reference

Base URL: `https://api.lasersell.io`

## Authentication

API key via header: `x-api-key: YOUR_API_KEY`

Required only for partner fee requests (Tier 2). All other endpoints work without authentication but benefit from higher rate limits with a key.

## Endpoints

### POST /v1/sell

Build an unsigned sell transaction.

**Request body:**

```json
{
  "mint": "TOKEN_MINT_PUBKEY",
  "user_pubkey": "WALLET_PUBKEY",
  "amount_tokens": 1000000,
  "slippage_bps": 2000,
  "output": "SOL",
  "send_mode": "rpc",
  "tip_lamports": 1000,
  "partner_fee_recipient": null,
  "partner_fee_bps": null,
  "partner_fee_lamports": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | string (Pubkey) | Yes | Token mint address |
| `user_pubkey` | string (Pubkey) | Yes | Wallet public key |
| `amount_tokens` | u64 | Yes | Token amount in atomic units. `0` = sell entire balance |
| `slippage_bps` | u16 | Yes | Slippage tolerance (100 = 1%). Max: 10000 |
| `output` | `"SOL"` or `"USD1"` | Yes | Output asset |
| `send_mode` | string | No | `"rpc"` (default), `"helius_sender"`, or `"astralane"` |
| `tip_lamports` | u64 | No | Priority fee. Default: 1000 |
| `partner_fee_recipient` | string (Pubkey) | No | Fee recipient (Tier 2 only) |
| `partner_fee_bps` | u16 | No | Fee in bps, max 50. Exclusive with lamports |
| `partner_fee_lamports` | u64 | No | Fee in lamports, max 50M. Exclusive with bps |

**Success response (200):**

```json
{
  "status": "ok",
  "tx": "BASE64_UNSIGNED_TX",
  "route": {
    "market_type": "pumpswap",
    "pool_id": "POOL_PUBKEY"
  }
}
```

### POST /v1/buy

Build an unsigned buy transaction.

**Request body:**

```json
{
  "mint": "TOKEN_MINT_PUBKEY",
  "user_pubkey": "WALLET_PUBKEY",
  "amount": 0.1,
  "slippage_bps": 2000,
  "input": "SOL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mint` | string (Pubkey) | Yes | Token mint address |
| `user_pubkey` | string (Pubkey) | Yes | Wallet public key |
| `amount` | f64 | One of | Human-readable input (e.g. 0.1 SOL) |
| `amount_in_total` | u64 | One of | Atomic input (e.g. 100000000 lamports) |
| `slippage_bps` | u16 | Yes | Slippage tolerance. Max: 10000 |
| `input` | `"SOL"` or `"USD1"` | Yes | Input asset |
| `send_mode` | string | No | Same as sell |
| `tip_lamports` | u64 | No | Same as sell |
| `partner_fee_*` | varies | No | Same as sell |

Either `amount` or `amount_in_total` must be provided, not both.

**Success response:** Same format as `/v1/sell`.

### GET /healthz

Health check.

**Response:** `{ "status": "ok" }`

## Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| 400 | `{ "error": "..." }` | Invalid request (bad JSON, missing fields, invalid pubkey, slippage > 10000) |
| 403 | `{ "error": "..." }` | Missing/invalid API key for partner fees |
| 404 | `{ "error": "route not found" }` | Mint not found or unsupported market |
| 404 | `{ "status": "not_indexed", "mint": "...", "reason": "..." }` | Mint not yet indexed |
| 422 | `{ "error": "..." }` | Unsupported token program or market |
| 429 | `{ "error": "rate limit exceeded" }` | Rate limit exceeded |
| 502 | `{ "error": "..." }` | Upstream RPC error |
| 503 | `{ "error": "..." }` | Service temporarily unavailable |

## Market Types

Values returned in `route.market_type`:

| Value | DEX |
|-------|-----|
| `pumpfun` | Pump.fun (bonding curve) |
| `pumpswap` | PumpSwap (post-graduation) |
| `raydium_launchpad` | Raydium LaunchLab |
| `raydium_cpmm` | Raydium CPMM |
| `meteora_dbc` | Meteora Dynamic Bonding Curve |
| `meteora_damm_v2` | Meteora Dynamic AMM v2 |

## Rate Limits

Default: 60 requests per IP per minute. Higher limits available on paid tiers.

## Default Client Configuration

| Setting | Value |
|---------|-------|
| Connect timeout | 200ms |
| Attempt timeout | 900ms |
| Max retries | 2 |
| Base URL | `https://api.lasersell.io` |
