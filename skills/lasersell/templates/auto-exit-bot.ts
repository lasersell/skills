/**
 * LaserSell Auto-Exit Bot Template
 *
 * Complete, copy-paste-ready bot that:
 * 1. Connects to the LaserSell stream
 * 2. Optionally buys a token
 * 3. Monitors positions and auto-submits exit transactions
 *
 * Setup:
 * 1. npm install @lasersell/lasersell-sdk @solana/web3.js
 * 2. Set environment variables: LASERSELL_API_KEY, KEYPAIR_PATH
 * 3. Run: npx tsx auto-exit-bot.ts [optional-mint-to-buy] [optional-amount-sol]
 */
import { readFile } from "node:fs/promises";
import { Keypair } from "@solana/web3.js";
import {
  ExitApiClient,
  StreamClient,
  StreamSession,
  StrategyConfigBuilder,
  proveOwnership,
  signUnsignedTx,
  sendTransaction,
  sendTargetHeliusSender,
} from "@lasersell/lasersell-sdk";

// --- Configuration ---
const API_KEY = process.env.LASERSELL_API_KEY!;
const KEYPAIR_PATH = process.env.KEYPAIR_PATH || "keypair.json";

const STRATEGY = new StrategyConfigBuilder()
  .targetProfitPct(50)
  .stopLossPct(10)
  .trailingStopPct(5)
  .liquidityGuard(true)
  .build();
const DEADLINE_TIMEOUT_SEC = 0; // 0 = disabled
const BUY_SLIPPAGE_BPS = 2_000; // 20%

// --- Main ---
async function main(): Promise<void> {
  const keypair = await loadKeypair(KEYPAIR_PATH);
  const walletPubkey = keypair.publicKey.toBase58();

  console.log(`Wallet: ${walletPubkey}`);
  console.log(`Strategy: ${JSON.stringify(STRATEGY)}`);

  // 1. Prove wallet ownership (local Ed25519 signature, no network call)
  const proof = proveOwnership(keypair);

  // 2. Register wallet (required before stream connection)
  const apiClient = ExitApiClient.withApiKey(API_KEY);
  await apiClient.registerWallet(proof);

  // 3. Connect stream with registered wallet
  const session = await new StreamClient(API_KEY).connectWithWallets(
    [proof],
    STRATEGY,
    DEADLINE_TIMEOUT_SEC,
  );
  console.log("Stream connected.");

  // 4. Optional: buy a token
  const mintToBuy = process.argv[2];
  const amountSol = parseFloat(process.argv[3] || "0");
  if (mintToBuy && amountSol > 0) {
    console.log(`Buying ${amountSol} SOL of ${mintToBuy}...`);
    const exitClient = ExitApiClient.withApiKey(API_KEY);
    const buyResponse = await exitClient.buildBuyTx({
      mint: mintToBuy,
      user_pubkey: walletPubkey,
      amount: amountSol,
      slippage_bps: BUY_SLIPPAGE_BPS,
      input: "SOL",
    });
    const signedBuy = signUnsignedTx(buyResponse.tx, keypair);
    const buySig = await sendTransaction(sendTargetHeliusSender(), signedBuy);
    console.log(`Buy submitted: ${buySig}`);
  }

  // 5. Event loop
  console.log("Monitoring positions...");
  while (true) {
    const event = await session.recv();
    if (event === null) {
      console.error("Stream ended.");
      break;
    }

    switch (event.type) {
      case "position_opened":
        console.log(`[OPEN] ${event.handle.mint} (wallet: ${event.handle.wallet_pubkey})`);
        break;

      case "pnl_update":
        if ("pnl_pct" in event.message) {
          console.log(`[PNL] position=${event.message.position_id} pnl=${event.message.pnl_pct}%`);
        }
        break;

      case "exit_signal_with_tx":
        if (event.message.type === "exit_signal_with_tx") {
          try {
            const signed = signUnsignedTx(event.message.unsigned_tx_b64, keypair);
            const sig = await sendTransaction(sendTargetHeliusSender(), signed);
            console.log(`[EXIT] ${event.message.mint} signature=${sig}`);
          } catch (err) {
            console.error(`[EXIT FAILED] ${event.message.mint}: ${err}`);
          }
        }
        break;

      case "position_closed":
        console.log(`[CLOSED] position=${event.message.position_id}`);
        break;

      case "liquidity_snapshot":
        // Tier 1+ only. Uncomment to log.
        // console.log(`[LIQUIDITY] position=${event.message.position_id} trend=${event.message.trend}`);
        break;
    }
  }
}

async function loadKeypair(path: string): Promise<Keypair> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Keypair file must be a JSON array of numbers");
  return Keypair.fromSecretKey(Uint8Array.from(parsed.map(Number)));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
