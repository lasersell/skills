# LaserSell Skills

AI coding skills for building with [LaserSell](https://lasersell.io) on Solana. Covers the LaserSell SDK, LaserSell API, and Exit Intelligence Stream.

## Skills

| Skill | Description |
|-------|-------------|
| [lasersell](skills/lasersell/) | AI coding skill for LaserSell covering automated exit strategies, one-shot buys/sells, real-time position monitoring, liquidity snapshots, and transaction signing/submission across Raydium, Pump.fun, PumpSwap, and Meteora. SDKs in TypeScript, Python, Rust, and Go. |

## Install

```bash
npx skills add lasersell/skills
```

Or install directly in Claude Code:

```bash
claude install-skill https://github.com/lasersell/skills/tree/main/skills/lasersell
```

Or copy the `skills/lasersell/` directory into your project's `.claude/skills/` directory.

## What's Included

```
skills/lasersell/
├── SKILL.md                        # Main skill (core SDK patterns and usage)
├── examples/                       # Runnable code in TypeScript, Python, Rust, Go
│   ├── auto-sell/                  # Stream-based auto-exit bot
│   ├── build-buy/                  # One-shot buy transaction
│   ├── build-sell/                 # One-shot sell transaction
│   └── build-and-send-sell/        # Build, sign, and submit a sell
├── docs/                           # Guides and troubleshooting
│   ├── troubleshooting.md          # Common errors and solutions
│   ├── ai-agent-integration.md     # Using LaserSell in AI agents
│   └── strategy-guide.md           # Exit strategy walkthrough
├── templates/                      # Copy-paste bot templates
│   ├── auto-exit-bot.ts            # TypeScript auto-exit bot
│   └── auto_exit_bot.py            # Python auto-exit bot
└── resources/                      # API and type references
    ├── api-reference.md            # /v1/sell and /v1/buy endpoint docs
    ├── types-reference.md          # SDK type definitions
    ├── stream-protocol.md          # WebSocket protocol messages
    └── program-addresses.md        # Solana program addresses
```

## MCP Server (alternative)

For real-time documentation search in your editor, add the [LaserSell MCP server](https://docs.lasersell.io/ai-agents/mcp-server):

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

## Links

- [LaserSell SDK](https://github.com/lasersell/lasersell-sdk)
- [LaserSell CLI](https://github.com/lasersell/lasersell)
- [Documentation](https://docs.lasersell.io)
- [API Reference](https://docs.lasersell.io/api/overview)
- [Discord](https://discord.gg/lasersell)

## License

[MIT](LICENSE)
