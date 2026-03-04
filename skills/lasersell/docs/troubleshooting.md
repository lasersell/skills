# Troubleshooting

Common issues and solutions when building with the LaserSell SDK.

## Connection Issues

### "stream ended unexpectedly"

The WebSocket connection was closed by the server.

**Causes:**
- Inactivity timeout (45 min on free tier). Send a `ping` or ensure positions are active.
- Network interruption between client and `wss://stream.lasersell.io`.
- API key revoked or expired.

**Fix:** Implement reconnection logic with exponential backoff. The SDK's `StreamSession` does not auto-reconnect; your application must detect the `null` return from `recv()` and create a new session.

### "rate limit exceeded" (HTTP 429)

Too many API requests from the same IP or API key.

**Fix:** Use the built-in `retryAsync()` with `LOW_LATENCY_RETRY_POLICY` which handles backoff automatically. For high-throughput applications, batch requests or upgrade to a higher tier.

### WebSocket authentication failure

The stream returns an `error` event immediately after connection.

**Causes:**
- Invalid or missing API key.
- API key does not have stream access.

**Fix:** Verify the API key at https://app.lasersell.io. Ensure the key is passed to `StreamClient` constructor, not `ExitApiClient`.

## Transaction Issues

### "route not found" (HTTP 404)

The API cannot find a valid route for the given token mint.

**Causes:**
- Token is not listed on any supported DEX.
- Token was recently launched and not yet indexed.
- Mint address is incorrect.

**Fix:** Verify the mint address on a Solana explorer. For newly launched tokens, wait a few seconds for indexing and retry.

### "not_indexed" (HTTP 404)

The token exists but has not been fully indexed yet.

**Fix:** Retry after a short delay. The service is processing the mint. This is transient.

### Transaction simulation failed / slippage exceeded

The signed transaction failed on-chain due to price movement between building and submitting.

**Causes:**
- `slippage_bps` too low for volatile tokens.
- Significant delay between building and submitting the transaction.

**Fix:**
- Increase `slippage_bps` (e.g., 2000 for 20%).
- Submit immediately after signing. Use `sendTargetHeliusSender()` for faster submission.
- For stream exits, LaserSell rebuilds the transaction with fresh data if the first one fails.

### "decode_unsigned_tx" or "deserialize_unsigned_tx" error

The base64 transaction string could not be decoded or deserialized.

**Causes:**
- Corrupted or truncated base64 string.
- Mixing up `buildSellTx()` (returns full response object) with `buildSellTxB64()` (returns just the base64 string). Make sure you pass `response.tx` not `response` to `signUnsignedTx()`.

### Transaction succeeds but no position tracked

The buy transaction landed on-chain but the stream did not detect the position.

**Cause:** The stream was not connected and configured before the buy transaction landed.

**Fix:** Always connect and configure the stream BEFORE submitting the buy transaction. The stream detects positions by watching on-chain token arrivals.

## Strategy Issues

### Trailing stop fires immediately

The trailing stop only fires after the position has been in profit (peak > 0). If it fires immediately, the position briefly went into profit and then dropped.

**Fix:** Use a larger `trailing_stop_pct` value, or combine with `target_profit_pct` as a minimum profit threshold.

### No exit signal received

**Causes:**
- No exit conditions configured (at least one of `target_profit_pct`, `stop_loss_pct`, `trailing_stop_pct`, or `deadline_timeout_sec` must be set).
- The position's PnL has not reached any threshold yet.
- The stream disconnected silently.

**Fix:** Monitor `pnl_update` events to verify the stream is tracking the position. Check that strategy thresholds are reasonable.

### "At least one exit condition must be enabled"

The `strategy` object was provided but all fields are null/undefined.

**Fix:** Set at least one of: `target_profit_pct`, `stop_loss_pct`, `trailing_stop_pct`. Or set `deadline_timeout_sec` > 0, or `sell_on_graduation` to true.

## Partner Fee Issues

### HTTP 403 on requests with partner fees

**Causes:**
- Missing `x-api-key` header.
- API key is not on Tier 2 (Advanced).
- `partner_fee_recipient` not provided alongside fee amount.

**Fix:** Partner fees require Tier 2. Verify tier at https://app.lasersell.io/billing.

### "partner_fee_bps and partner_fee_lamports are mutually exclusive"

Both fee fields were set on the same request.

**Fix:** Use one or the other. `partner_fee_bps` for percentage-based fees (max 50 = 0.5%), `partner_fee_lamports` for fixed fees (max 50,000,000 = 0.05 SOL).
