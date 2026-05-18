# GenLayer Integration Plan — Patchwork Truth

## Goal
Integrate the game with GenLayer infrastructure: Python intelligent contracts for AI evaluation + optimistic democracy for challenge resolution.

---

## Step 1: Update package.json

Add GenLayer CLI and scripts:

```json
{
  "scripts": {
    "dev": "node --watch src/server.js",
    "start:api": "node src/server.js",
    "deploy": "genlayer deploy contracts/PatchworkTruth.sol",
    "test:contracts": "gltest"
  },
  "devDependencies": {
    "genlayer": "latest"
  }
}
```

---

## Step 2: Create Python Intelligent Contract

**File: `contracts/PatchworkTruth.py`**

The contract replaces the local `evaluateNarrative()` in `engine.js`. It receives:
- Final narrative text
- All player contributions
- Scenario rubric criteria

Uses GenLayer's LLM access (`gl.nondet.exec_prompt`) to score:
- Coherence (0-25)
- Evidence Integration (0-25)
- Argument Quality (0-25)
- Manipulation Resistance (0-25)

Stores results on-chain and emits events.

---

## Step 3: Create Challenge Contract

**File: `contracts/PatchworkChallenge.py`**

Handles the Optimistic Democracy challenge window:
- Players can submit challenges within the time window
- Vote/counting mechanism using GenLayer's LLM
- Resolution updates player scores and XP on-chain

---

## Step 4: Modify Server (`src/server.js`)

Replace local scoring calls with contract calls:
```js
// Before (local)
evaluateNarrative(room, rubric);

// After (GenLayer)
const evaluation = await callContract("evaluate", { narrative, contributions });
room.evaluation = evaluation;
```

Replace challenge resolution with contract call:
```js
// Before (local)
resolveChallenges(room, decisions);

// After (GenLayer)
await callContract("resolveChallenge", { playerId, reason });
```

---

## Step 5: Add Wallet Connection (Optional Enhancement)

For full on-chain:
- Connect player wallet via `frontend/lib/genlayer/WalletProvider.tsx`
- Sign game actions with wallet
- Store room state on GenLayer contract

MVP: Keep server as bridge (off-chain scoring → on-chain result storage).

---

## Files to Create

| File | Purpose |
|------|---------|
| `contracts/PatchworkTruth.py` | AI evaluation contract |
| `contracts/PatchworkChallenge.py` | Challenge/appeal contract |
| `deploy/02_patchwork.js` | Deployment script |
| `frontend/.env.example` | Env template |

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add genlayer dep + deploy/test scripts |
| `src/server.js` | Replace local calls with contract calls |
| `CLAUDE.md` | Add Patchwork Truth contract reference |

---

## Implementation Order

1. **Create contracts** — Python files using GenLayer SDK
2. **Test locally** — `gltest` against studionet
3. **Deploy** — `npm run deploy` → copy address to env
4. **Update server** — Route evaluation/challenge to contract
5. **Test full flow** — End-to-end with GenLayer

> **Contract address** (placeholder): `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env`
> **SDK docs**: https://sdk.genlayer.com/main/_static/ai/api.txt