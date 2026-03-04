"""
LaserSell Auto-Exit Bot Template

Complete, copy-paste-ready bot that:
1. Connects to the LaserSell stream
2. Optionally buys a token
3. Monitors positions and auto-submits exit transactions

Setup:
1. pip install lasersell-sdk solders
2. Set environment variables: LASERSELL_API_KEY, KEYPAIR_PATH
3. Run: python auto_exit_bot.py [optional-mint-to-buy] [optional-amount-sol]
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from solders.keypair import Keypair

from lasersell_sdk.exit_api import BuildBuyTxRequest, ExitApiClient
from lasersell_sdk.stream.client import StreamClient, StreamConfigure
from lasersell_sdk.stream.session import StreamSession
from lasersell_sdk.tx import SendTargetHeliusSender, send_transaction, sign_unsigned_tx

# --- Configuration ---
API_KEY = os.environ["LASERSELL_API_KEY"]
KEYPAIR_PATH = os.environ.get("KEYPAIR_PATH", "keypair.json")

STRATEGY = {
    "target_profit_pct": 50,
    "stop_loss_pct": 10,
    "trailing_stop_pct": 5,
}
DEADLINE_TIMEOUT_SEC = 0  # 0 = disabled
BUY_SLIPPAGE_BPS = 2_000  # 20%


async def main() -> None:
    keypair = load_keypair(Path(KEYPAIR_PATH))
    wallet_pubkey = str(keypair.pubkey())

    print(f"Wallet: {wallet_pubkey}")
    print(f"Strategy: TP={STRATEGY['target_profit_pct']}% SL={STRATEGY['stop_loss_pct']}% TS={STRATEGY['trailing_stop_pct']}%")

    # 1. Connect stream FIRST
    session = await StreamSession.connect(
        StreamClient(API_KEY),
        StreamConfigure(
            wallet_pubkeys=[wallet_pubkey],
            strategy=STRATEGY,
            deadline_timeout_sec=DEADLINE_TIMEOUT_SEC,
        ),
    )
    print("Stream connected.")

    # 2. Optional: buy a token
    mint_to_buy = sys.argv[1] if len(sys.argv) > 1 else None
    amount_sol = float(sys.argv[2]) if len(sys.argv) > 2 else 0
    if mint_to_buy and amount_sol > 0:
        print(f"Buying {amount_sol} SOL of {mint_to_buy}...")
        exit_client = ExitApiClient.with_api_key(API_KEY)
        buy_response = await exit_client.build_buy_tx(BuildBuyTxRequest(
            mint=mint_to_buy,
            user_pubkey=wallet_pubkey,
            amount=amount_sol,
            slippage_bps=BUY_SLIPPAGE_BPS,
        ))
        signed_buy = sign_unsigned_tx(buy_response.tx, keypair)
        buy_sig = await send_transaction(SendTargetHeliusSender(), signed_buy)
        print(f"Buy submitted: {buy_sig}")

    # 3. Event loop
    print("Monitoring positions...")
    while True:
        event = await session.recv()
        if event is None:
            print("Stream ended.", file=sys.stderr)
            break

        if event.type == "position_opened" and event.handle:
            print(f"[OPEN] {event.handle.mint} (wallet: {event.handle.wallet_pubkey})")

        elif event.type == "pnl_update":
            pnl = event.message.get("pnl_pct", "?")
            pid = event.message.get("position_id", "?")
            print(f"[PNL] position={pid} pnl={pnl}%")

        elif event.type == "exit_signal_with_tx" and event.message.get("type") == "exit_signal_with_tx":
            try:
                signed = sign_unsigned_tx(event.message["unsigned_tx_b64"], keypair)
                sig = await send_transaction(SendTargetHeliusSender(), signed)
                print(f"[EXIT] {event.message['mint']} signature={sig}")
            except Exception as err:
                print(f"[EXIT FAILED] {event.message.get('mint', '?')}: {err}", file=sys.stderr)

        elif event.type == "position_closed":
            print(f"[CLOSED] position={event.message.get('position_id', '?')}")


def load_keypair(path: Path) -> Keypair:
    raw = path.read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, list):
        raise ValueError("Keypair file must be a JSON array of numbers")
    return Keypair.from_bytes(bytes(int(v) for v in parsed))


if __name__ == "__main__":
    asyncio.run(main())
