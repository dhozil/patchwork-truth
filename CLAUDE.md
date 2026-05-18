# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

```bash
npm install          # Install dependencies
npm start            # Start the server (http://localhost:3000)
```

## Architecture

```
public/              # Browser-facing files (served statically)
│   ├── index.html   # Single-page HTML with all screens
│   ├── styles.css  # Dark theme, animations
│   ├── main.js     # Client-side game logic, polling, UI
│   └── wallet.js   # GenLayer JS + MetaMask integration

src/                 # Server-side Node.js
│   ├── index.js          # Express app entry point
│   ├── server.js        # API routes — rooms, finalize, leaderboard
│   ├── contractService.js  # genlayer-js reads for on-chain data
│   └── game/
│       ├── state.js     # Room state, phase timers, fragment distribution
│       ├── engine.js    # Phase transitions, scoring
│       ├── scenarios.js # Game themes / scenarios
│       ├── scoring.js   # Rubric fallback scoring
│       └── sampleData.js # Sample fragments / contributions
```

**Frontend stack**: Vanilla JS, CSS (no framework), browser-direct MetaMask signing via `genlayer-js` CDN.

**Backend stack**: Node.js + Express, in-memory room state (`Map`), GenLayer Studio RPC for contract reads.

## Key Concepts

### GenLayer Intelligent Contracts

Contracts are Python-based and run in the GenVM. The key primitives used in `wallet.js`:

```python
# AI evaluation via LLM
gl.nondet.exec_prompt(prompt: str) -> str

# Validator consensus on non-deterministic output
gl.eq_principle.strict_eq(expected: str, actual: str) -> bool
```

### Browser-Direct Signing Pattern

**Important**: All transaction signing happens directly in the browser via `genlayer-js` + MetaMask. The server NEVER holds private keys.

```
Browser (MetaMask) ──sign──> genlayer-js SDK ──RPC──> GenLayer Studionet
                            │
Wallet.evaluateNarrative()   ├── readContract()  → public view methods
Wallet.writeContract()      └── writeContract() → signed TX via MetaMask
```

Server only does:
- Room state management (in-memory `Map`)
- On-chain reads via `genlayer-js` (read-only, no signing)
- Batch-finalize trigger when all players submit

### Contract Address

```
0x5700c8ce661A7A00780Bc1b99C046C424D284E5E  (GenLayer Studionet)
```

## Development Workflow

1. Start server: `npm start`
2. Open: `http://localhost:3000`
3. Connect MetaMask → auto-adds GenLayer Studio network
4. Host creates room → share code → players join

## Wallet Integration (wallet.js)

```javascript
// Wallet.getState() → { address, chainId, isConnected, isOnCorrectNetwork, playerName, ... }
// Wallet.connect()   → prompt MetaMask, switch to Studionet
// Wallet.evaluateNarrative(matchId, scenarioId, narrative, fragments, contributions)
//   → submits AI evaluation TX via MetaMask, returns scores object
// Wallet.read(functionName, args)
//   → read-only contract call (no signing)
// Wallet.getLeaderboard()
// Wallet.getPlayerProfile(address)
```

## Game Phases

```
lobby → fragment_distribution → negotiation → drafting → evaluation → challenge_window → results
```

- `advancePhaseUI(nextPhase, players)` — syncs panel visibility + phase timeline
- `startTimerPoll()` — polls `/rooms/:roomCode` every 2s
- `gameFinalized` flag — blocks poll from overwriting results state

## GenLayer Documentation

| Resource | URL |
|----------|-----|
| SDK API | https://sdk.genlayer.com/main/_static/ai/api.txt |
| Docs | https://docs.genlayer.com/ |
| GenLayerJS | https://docs.genlayer.com/api-references/genlayer-js |
| Studionet Explorer | https://studio.genlayer.com/explorer |