# AI Agent Integration

How to use LaserSell in AI agents and autonomous trading systems.

## Why LaserSell for AI Agents

LaserSell offloads DEX routing, slippage optimization, and transaction construction to the API. An AI agent does not need to understand Solana's low-level mechanics. A trade executes in a single API call: pass a mint address and amount, get back a ready-to-sign transaction.

## Architecture for AI Agents

```
AI Agent (decision logic)
    |
    v
LaserSell SDK (build unsigned tx)
    |
    v
Local Signing (sign with keypair)
    |
    v
Solana Network (submit signed tx)
```

The agent controls the decision layer. LaserSell handles execution.

## Minimal Agent: Buy and Auto-Exit

```typescript
import {
  ExitApiClient, StreamClient, StreamSession,
  signUnsignedTx, sendTransaction, sendTargetHeliusSender,
} from "@lasersell/lasersell-sdk";

async function agentTrade(mint: string, amountSol: number, keypair: Keypair) {
  const apiKey = process.env.LASERSELL_API_KEY!;
  const walletPubkey = keypair.publicKey.toBase58();

  // 1. Connect stream FIRST (must be watching before buy lands)
  const session = await StreamSession.connect(new StreamClient(apiKey), {
    wallet_pubkeys: [walletPubkey],
    strategy: { target_profit_pct: 50, stop_loss_pct: 10, trailing_stop_pct: 5 },
    deadline_timeout_sec: 300,
    send_mode: "helius_sender",
    tip_lamports: 1000,
  });

  // 2. Buy
  const exitClient = ExitApiClient.withApiKey(apiKey);
  const buyResponse = await exitClient.buildBuyTx({
    mint, user_pubkey: walletPubkey, amount: amountSol,
    slippage_bps: 2_000, input: "SOL",
  });
  const signedBuy = signUnsignedTx(buyResponse.tx, keypair);
  await sendTransaction(sendTargetHeliusSender(), signedBuy);

  // 3. Auto-exit loop
  while (true) {
    const event = await session.recv();
    if (event === null) break;
    if (event.type === "exit_signal_with_tx" && event.message.type === "exit_signal_with_tx") {
      const signed = signUnsignedTx(event.message.unsigned_tx_b64, keypair);
      await sendTransaction(sendTargetHeliusSender(), signed);
      return; // trade complete
    }
  }
}
```

## Key Patterns

### Separate Decision from Execution

The agent decides WHAT to trade. LaserSell decides HOW to execute. Do not have the agent construct Solana transactions directly.

### Stream Before Buy

Always connect and configure the stream before submitting a buy. The stream detects positions by watching token arrivals on-chain.

### Non-Custodial

Private keys stay on the agent's machine. The LaserSell API never sees them. This means the agent must have access to the keypair for signing.

### Error Recovery

- If a buy fails, the stream simply has no position to track. No cleanup needed.
- If an exit submission fails, LaserSell may retry the signal. The agent should log errors and continue processing.
- If the stream disconnects, reconnect with a new session. Existing positions on-chain are not affected.

### Liquidity-Aware Selling

For large positions, use liquidity snapshots to avoid excessive slippage:

```typescript
const maxTokens = session.getMaxSellAtSlippage(positionId, 500); // 5%
if (maxTokens && maxTokens > 0) {
  await exitClient.buildPartialSellTx(handle, maxTokens, { slippageBps: 500, output: "SOL" });
}
```

## Framework Integration

### LangChain / Vercel AI SDK

Define LaserSell tools:

```typescript
const buyTool = {
  name: "buy_token",
  description: "Buy a Solana token by mint address",
  parameters: { mint: "string", amount_sol: "number" },
  execute: async ({ mint, amount_sol }) => {
    const response = await exitClient.buildBuyTx({
      mint, user_pubkey: walletPubkey,
      amount: amount_sol, slippage_bps: 2_000, input: "SOL",
    });
    const signed = signUnsignedTx(response.tx, keypair);
    return await sendTransaction(sendTargetHeliusSender(), signed);
  },
};
```

### Solana Agent Kit

LaserSell can replace the default swap execution in Solana Agent Kit. Use `ExitApiClient` to build transactions instead of Jupiter or Raydium directly.

## MCP Server

For AI tools that support MCP (Claude Code, Cursor, Windsurf), add the LaserSell MCP server for real-time documentation access:

```json
{
  "mcpServers": {
    "lasersell-docs": {
      "type": "streamable-http",
      "url": "https://docs.lasersell.io/mcp"
    }
  }
}
```
