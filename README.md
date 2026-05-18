# Patchwork Truth

> *Build narratives. Challenge consensus. Win through clarity.*

A competitive multiplayer narrative game powered by **GenLayer Intelligent Contracts** — where AI-driven consensus evaluates your writing in real-time on-chain.

---

## Overview

**Patchwork Truth** is a multiplayer strategy game where players receive scattered story fragments and must write the strongest possible narrative by assembling them into a coherent argument. Every submission is scored by an **AI consensus engine** running on GenLayer's intelligent contracts, with validator nodes agreeing on the evaluation — no human judge, no manipulation.

Currently featuring **8 scenario themes** with unique evidence pools.

---

## Game Flow

```
Lobby → Fragment Distribution → Negotiation → Final Draft → AI Evaluation → Challenge Window → Results
```

| Phase | Description |
|-------|-------------|
| **Lobby** | Host creates a room, shares a code. Players join. |
| **Fragment Distribution** | Each player receives 3 random story fragments from a 16-fragment pool |
| **Negotiation** | Players write contributions based on their fragments |
| **Final Draft** | Host crafts the final narrative — scored by GenLayer AI Consensus |
| **AI Evaluation** | GenLayer validators reach consensus on 4 dimensions |
| **Challenge Window** | Players can challenge the AI evaluation. Correct challenges earn bonus XP |
| **Results** | Rankings revealed with per-player scores |

---

## Scoring Rubric (AI Consensus)

Each narrative is evaluated across 4 dimensions on a 0–25 scale:

| Dimension | Description |
|-----------|-------------|
| **Coherence** | Logical flow and internal consistency |
| **Evidence Integration** | How well fragments are woven into the argument |
| **Argument Quality** | Strength and clarity of reasoning |
| **Manipulation Resistance** | Avoids overreach, acknowledges uncertainty |

**Total score: 0–100** (with bonus XP for successful challenges)

---

## Leaderboard

Global leaderboard with two tracking modes:

| Tab | Description |
|-----|-------------|
| **Score** | Highest score achieved in a single game |
| **XP** | Accumulated XP from all games played |

Scores are persisted on-chain via GenLayer intelligent contracts.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | GenLayer Studio Network (chain ID `0xF22F` / 61999) |
| **AI Consensus** | `gl.nondet.exec_prompt()` + `gl.eq_principle.strict_eq()` in intelligent contracts |
| **Client** | Vanilla JS, CSS (no framework), browser-direct MetaMask signing |
| **Wallet SDK** | `genlayer-js` (CDN) — browser-only wallet integration |
| **Contract** | Deployed at `0x5700c8ce661A7A00780Bc1b99C046C424D284E5E` |
| **Server** | Node.js + Express |
| **Intelligent Contract** | Python via GenLayer SDK |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) browser extension
- GenLayer Studio network added to MetaMask (auto-added on connection)

### Run locally

```bash
# Install dependencies
npm install

# Copy and configure environment
cp .env.secrets frontend/.env
# Edit frontend/.env with your values

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

### Add GenLayer Studio network to MetaMask

The app auto-adds it on first connection. Or manually:
- **Chain ID:** `0xF22F` (61999)
- **RPC URL:** `https://studio.genlayer.com/api`
- **Block Explorer:** `https://studio.genlayer.com/explorer`

---

## Project Structure

```
patchwork-truth/
├── contracts/
│   └── PatchworkTruth.py     # GenLayer intelligent contract (Python)
├── public/
│   ├── index.html            # Single-page HTML with all screens
│   ├── styles.css            # Dark theme, animations
│   ├── main.js               # Client-side game logic, polling, UI
│   ├── wallet.js             # GenLayer JS + MetaMask integration
│   ├── genlayer-js.js        # Bundled GenLayer SDK
│   ├── sounds.js             # Sound effects
│   └── examples.js           # Example contributions & narratives
├── frontend/
│   ├── .env.example         # Environment template
│   └── lib/                  # Frontend utilities
├── src/
│   ├── index.js              # Entry point
│   ├── server.js             # Express API — rooms, finalize, leaderboard
│   ├── contractService.js    # genlayer-js on-chain reads/writes
│   └── game/
│       ├── state.js          # Room state, phase timers, fragment distribution
│       ├── engine.js          # Game engine — phase transitions, scoring
│       ├── scenarios.js      # 8 game themes / scenario packs
│       ├── scoring.js         # Rubric fallback scoring
│       └── sampleData.js      # Sample fragments / contributions
├── scripts/
│   └── bundle-genlayer.js    # Bundles genlayer-js for wallet CDN
├── docs/
│   └── game-design.md         # Game design document
├── deploy/
│   └── deploy.js             # Contract deployment scripts
├── package.json
├── CLAUDE.md
└── README.md
```

---

## Key Features

### AI Consensus Evaluation
Every narrative is scored by an intelligent contract that runs an LLM prompt via GenLayer. All validator nodes independently compute the score and must agree — if consensus fails, the transaction reverts.

### Disjoint Fragment System
Each player receives 3 random fragments from a 16-fragment pool. No player has the full picture — negotiation is required to build the complete narrative.

### 8 Scenario Themes
Unique evidence pools and story contexts:
- Mystery investigations
- Corporate incidents
- Historical events
- Technical incidents
- ...and more

### GenLayer TX Timeout Safety
AI evaluation transactions are wrapped in a timeout + retry system. If MetaMask signing takes too long, the server falls back to a rubric-based score — no frozen UI.

### Room Lifecycle
- **Host** controls phase advancement and can destroy the room
- **Non-host** players can leave at any time
- "New Room" button is hidden once the game enters in-game phases

---

## Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode (auto-restart on changes)
npm run dev

# Deploy contract to GenLayer Studionet
npm run deploy
```

---

## Known Limitations

- GenLayer Studio is a test network — scores may vary during network upgrades
- AI evaluation can take 30–90 seconds per narrative due to validator consensus time
- Solo mode uses rubric fallback scoring since no competitive comparison is possible

---

## License

MIT — built for the GenLayer community.