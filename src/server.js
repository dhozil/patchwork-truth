const path = require("path");
const express = require("express");
const cors = require("cors");
const { createPlayer, createRoom, getPhaseDurationSeconds, allPlayersSubmitted, markSubmitted, getPhaseRemainingSeconds, startPhaseTimer, startReadyCountdown, markReady, allPlayersReady, getReadyRemainingSeconds, kickNotReady, resetReady } = require("./game/state");
const {
  PHASES,
  distributeFragments,
  runNegotiation,
  finalizeNarrative,
  evaluateNarrative,
  resolveChallenges,
  buildLeaderboard
} = require("./game/engine");
const { fragments, rubric: defaultRubric } = require("./game/sampleData");
const { getScenarios, getScenario, getFragmentsForScenario, getShuffledFragments } = require("./game/scenarios");
const contractService = require("./contractService");
const ENABLE_CONTRACT = process.env.ENABLE_CONTRACT === "true";

// Root directory for static files (works both locally and on Vercel)
const ROOT_DIR = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(PUBLIC_DIR));

// Root route → serve index.html as the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

const rooms = new Map();
const globalLeaderboard = new Map();  // player_address → { name, score, mode, gamesPlayed }
const PHASE_ORDER = [
  PHASES.LOBBY,
  PHASES.DISTRIBUTION,
  PHASES.NEGOTIATION,
  PHASES.DRAFTING,
  PHASES.EVALUATION,
  PHASES.CHALLENGE,
  PHASES.RESULTS
];

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createPlayerId() {
  return `p_${Math.random().toString(36).slice(2, 8)}`;
}

function getRoomOr404(req, res) {
  const room = rooms.get(req.params.roomCode);
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return null;
  }
  return room;
}

function findPlayer(room, playerId) {
  return room.players.find((player) => player.id === playerId);
}

function requireHost(room, actorId, res) {
  if (!actorId) {
    res.status(400).json({ error: "hostId is required" });
    return false;
  }
  if (room.hostId !== actorId) {
    res.status(403).json({ error: "Only host can perform this action" });
    return false;
  }
  return true;
}

function requireRoomPhase(room, allowedPhases, res, message) {
  if (!allowedPhases.includes(room.phase)) {
    res.status(400).json({ error: message || `Invalid phase: ${room.phase}` });
    return false;
  }
  return true;
}

function sanitizeRoom(room) {
  const readyRemaining = getReadyRemainingSeconds(room);
  // Build per-player final narratives + scores for competitive ranking
  const playerResults = room.players.map(p => {
    const narrativeData = room.finalNarratives?.[p.id];
    const score = narrativeData?.totalScore || 0;
    // Prefer aiScores (normalized camelCase), fall back to rubricScores (fallback format)
    const rawScores = narrativeData?.aiScores || narrativeData?.rubricScores || null;
    // Normalize to display format (evidenceIntegration, argumentQuality, manipulationResistance)
    const rubricScores = rawScores ? {
      coherence: rawScores.coherence || rawScores.coherence || 0,
      evidenceIntegration: rawScores.evidenceIntegration || rawScores.evidence || 0,
      argumentQuality: rawScores.argumentQuality || rawScores.argument || 0,
      manipulationResistance: rawScores.manipulationResistance || rawScores.manipulation || 0
    } : null;
    return {
      id: p.id,
      name: p.name,
      text: narrativeData?.text || null,
      score,
      rubricScores,
      aiConsensus: narrativeData?.aiConsensus || false,
      aiScores: rubricScores  // aliased so client can use either field
    };
  });
  // Use forced player results from batch-finalize (when some players still on fallback)
  // so polling clients can render partial results immediately without waiting for /ai-result.
  const prOverride = room._forcedPlayerResults || playerResults;
  // Sort by score descending to compute rank
  prOverride.sort((a, b) => b.score - a.score);
  prOverride.forEach((p, idx) => { p.rank = idx + 1; });

  // Build aggregate evaluation from each player's own AI scores.
  // evaluation is now per-player so every caller (including non-host) can detect
  // when batch-finalize ran and render results without needing serverHasResult.
  const playerEvaluations = {};
  room.players.forEach(p => {
    const nd = room.finalNarratives?.[p.id];
    playerEvaluations[p.id] = nd
      ? {
          totalScore: nd.totalScore || 0,
          aiConsensus: nd.aiConsensus || false,
          aiScores: nd.aiScores || null,
          rubricScores: nd.rubricScores || null
        }
      : null;
  });

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    phase: room.phase,
    scenario: room.scenario || null,
    scenarioSeed: room.scenarioSeed,
    speedMode: room.speedMode,
    match: room.match,
    playerCount: room.players.length,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      fragments: player.fragments,
      ready: player.ready
    })),
    timeline: room.timeline,
    // Per-player scoring for competitive mode — returned to all players for ranking
    playerResults: prOverride,
    totalPlayers: room.players.length,
    // Per-player evaluation so non-host callers can detect batch-finalize via score > 0
    evaluation: playerEvaluations[room.hostId] || room.evaluation || null,
    playerEvaluations,
    phaseTimer: room.phaseTimers[room.phase] || null,
    remainingSeconds: getPhaseRemainingSeconds(room),
    allSubmitted: allPlayersSubmitted(room),
    submissionsCount: (room.submissionsPerPhase[room.phase] || []).length,
    // Ready system
    waitingForReady: room.waitingForReady || false,
    readyTimeout: room.readyTimeout ? {
      remainingSeconds: getReadyRemainingSeconds(room),
      totalSeconds: room.readyTimeout.durationSeconds
    } : null,
    readiedCount: room.readiedPlayers ? room.readiedPlayers.size : room.players.filter(p => p.ready).length,
    allReady: allPlayersReady(room),
    kickedFromRoom: room.kickedFromRoom || []
  };
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "patchwork-truth-api" });
});

// List available scenarios
app.get("/scenarios", (req, res) => {
  res.json({ scenarios: getScenarios() });
});

// Get scenario details
app.get("/scenarios/:scenarioId", (req, res) => {
  const scenario = getScenario(req.params.scenarioId);
  res.json({ id: scenario.id, label: scenario.label, emoji: scenario.emoji, tagline: scenario.tagline, color: scenario.color, prompt: scenario.prompt });
});

app.post("/rooms", (req, res) => {
  const hostName = req.body.hostName || "Host";
  const scenarioId = req.body.scenarioId || "mystery";
  const speedMode = req.body.speedMode === true;

  const scenario = getScenario(scenarioId);
  const host = createPlayer(createPlayerId(), hostName);
  const roomCode = createRoomCode();
  console.log(`[Server] Room ${roomCode} created by host ${host.id} ("${hostName}"). Players: 1`);

  const room = createRoom({
    roomCode,
    hostId: host.id,
    players: [host],
    scenarioSeed: `week-${new Date().toISOString().slice(0, 10)}`,
    speedMode
  });

  room.scenario = {
    id: scenario.id,
    label: scenario.label,
    emoji: scenario.emoji,
    color: scenario.color,
    prompt: scenario.prompt,
    guideContribution: scenario.guideContribution,
    guideNarrative: scenario.guideNarrative
  };

  rooms.set(roomCode, room);
  res.status(201).json({ roomCode, hostId: host.id, room: sanitizeRoom(room), scenario: room.scenario });
});

app.post("/rooms/:roomCode/join", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (room.phase !== PHASES.LOBBY) {
    res.status(400).json({ error: "Match already started" });
    return;
  }

  const name = req.body.name;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const player = createPlayer(createPlayerId(), name);
  room.players.push(player);
  console.log(`[Server] Player "${name}" (${player.id}) joined room ${req.params.roomCode}. Total: ${room.players.length} — ${room.players.map(p => p.name).join(", ")}`);
  res.status(201).json({ playerId: player.id, room: sanitizeRoom(room) });
});

// Host destroys the room — all non-host players are notified and should return to menu
app.post("/rooms/:roomCode/destroy", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireHost(room, req.body.hostId, res)) return;

  console.log(`[Server] Host ${room.hostId} destroyed room ${room.roomCode} — ${room.players.length} player(s) affected`);
  rooms.delete(room.roomCode);
  res.json({ destroyed: true, reason: "Room closed by host" });
});

app.post("/rooms/:roomCode/start", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireHost(room, req.body.hostId, res)) return;
  if (!requireRoomPhase(room, [PHASES.LOBBY], res, "Match can only start from lobby")) return;
  const allowSolo = req.body.allowSolo !== false;
  if (room.players.length < 2 && !allowSolo) {
    res.status(400).json({ error: "Need at least 2 players to start unless allowSolo is true" });
    return;
  }

  // Speed mode from body (can override room setting)
  if (req.body.speedMode !== undefined) room.speedMode = req.body.speedMode;

  const playerCount = room.players.length;
  const durationMinutes = Math.max(3, Math.min(15, Number(req.body.durationMinutes || 10)));
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);

  room.match = {
    startedAt: startedAt.toISOString(),
    durationMinutes,
    endsAt: endsAt.toISOString(),
    speedMode: room.speedMode,
    playerCount
  };

  // Assign shuffled scenario fragments to each player
  // Each player gets DIFFERENT 3 fragments — shuffled once, distributed evenly (no overlap)
  const scenarioFragments = getFragmentsForScenario(room.scenario?.id || "mystery");
  const shuffled = [...scenarioFragments].sort(() => Math.random() - 0.5);
  const perPlayer = 3;
  room.players.forEach((player, i) => {
    player.fragments = shuffled.slice(i * perPlayer, (i + 1) * perPlayer);
  });
  console.log(`[Server] Fragments in room ${room.roomCode}: ${room.players.map(p => p.name + " gets [" + p.fragments.map(f => f.type).join(", ") + "]").join(", ")}`);
  room.phase = PHASES.DISTRIBUTION;
  room.timeline.push({ at: new Date().toISOString(), phase: PHASES.DISTRIBUTION });
  console.log(`[Server] Match started in room ${room.roomCode}. Players: ${room.players.length} — ${room.players.map(p => p.name).join(", ")}`);
  // Start phase timer for distribution phase
  startPhaseTimer(room, PHASES.DISTRIBUTION, playerCount);

  res.json({
    message: "Match started",
    mode: playerCount < 2 ? "solo" : "multiplayer",
    speedMode: room.speedMode,
    totalDurationMinutes: Math.round(getPhaseDurationSeconds(PHASES.DISTRIBUTION, playerCount, room.speedMode) / 60 * 10) / 10,
    phaseTimers: room.phaseTimers,
    room: sanitizeRoom(room)
  });
});

app.post("/rooms/:roomCode/contributions", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  const phase = room.phase;
  // Allow contributions in DISTRIBUTION, NEGOTIATION, and DRAFTING
  if (!requireRoomPhase(room, [PHASES.DISTRIBUTION, PHASES.NEGOTIATION, PHASES.DRAFTING], res, "Contribution phase is not active")) return;

  const { playerId, text, accepted } = req.body;
  if (!playerId || !text) {
    res.status(400).json({ error: "playerId and text are required" });
    return;
  }
  if (!findPlayer(room, playerId)) {
    console.warn(`[Server] Player ${playerId} not found in room ${req.params.roomCode}. Room players:`, room.players.map(p => p.id));
    res.status(404).json({ error: "Player not found in room" });
    return;
  }

  room.submissions.push({ playerId, text, accepted: Boolean(accepted) });
  markSubmitted(room, playerId);
  runNegotiation(room, room.submissions);
  console.log(`[Server] Contribution from ${playerId} in room ${req.params.roomCode}. Room phase=${phase}, players=${room.players.length} — ${room.players.map(p => p.name).join(", ")}`);

  const remaining = getPhaseRemainingSeconds(room);
  res.status(201).json({
    message: "Contribution recorded",
    allSubmitted: allPlayersSubmitted(room),
    autoAdvanced: room.speedMode && allPlayersSubmitted(room),
    remainingSeconds: remaining,
    submittedCount: (room.submissionsPerPhase[room.phase] || []).length,
    totalPlayers: room.players.length
  });
});

app.post("/rooms/:roomCode/finalize", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  const { playerId, text, aiScores, totalScore } = req.body;
  if (!playerId || !text) {
    res.status(400).json({ error: "playerId and text are required" });
    return;
  }

  if (!requireRoomPhase(room, [PHASES.NEGOTIATION, PHASES.DRAFTING, PHASES.EVALUATION, PHASES.RESULTS], res, "Finalize is only allowed from negotiation or evaluation phase")) return;

  // Check player exists in room
  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found in room" });
    return;
  }

  // Store this player's final narrative + scores
  room.finalNarratives = room.finalNarratives || {};
  const existingEntry = room.finalNarratives[playerId] || {};
  room.finalNarratives[playerId] = {
    ...existingEntry,
    text,
    submittedAt: new Date().toISOString()
  };

  // Store AI consensus scores if provided (from browser Wallet.evaluateNarrative())
  // Contract returns snake_case (evidence, argument, manipulation) — normalize to camelCase
  if (aiScores && Object.keys(aiScores).length > 0) {
    const normalizedScores = {
      coherence: aiScores.coherence || 0,
      evidenceIntegration: aiScores.evidence || aiScores.evidenceIntegration || 0,
      argumentQuality: aiScores.argument || aiScores.argumentQuality || 0,
      manipulationResistance: aiScores.manipulation || aiScores.manipulationResistance || 0
    };
    room.finalNarratives[playerId].aiScores = normalizedScores;
    room.finalNarratives[playerId].totalScore = parseInt(totalScore) || 0;
    room.finalNarratives[playerId].aiConsensus = true;
    console.log(`[Server] AI consensus scores for ${player.name}: total=${totalScore}`);
  }

  console.log(`[Server] Player ${player.name} submitted final narrative. Total finalized: ${Object.keys(room.finalNarratives).length}/${room.players.length}`);

  // Check if ALL players have submitted their final narratives
  // A player is "finalized" only if they have BOTH text AND a totalScore (AI or fallback)
  // This prevents premature batch-finalize when host submits text but AI scores haven't arrived yet
  const playersWithScores = room.players.filter(p => room.finalNarratives[p.id]?.totalScore !== undefined);
  const allHaveScores = playersWithScores.length === room.players.length;
  const allHaveText = room.players.every(p => room.finalNarratives[p.id]?.text);

  // Track if host has called finalize without AI scores (waiting for GenLayer TX to confirm).
  // When host re-calls /finalize with AI scores → immediately trigger batch-finalize.
  if (playerId === room.hostId && room.finalNarratives[playerId]?.text && room.finalNarratives[playerId]?.totalScore === undefined) {
    room._pendingHostFinalize = true;
  }

  // If host re-calls /finalize with AI scores AND all other players already have their scores,
  // run batch-finalize immediately (don't make host wait for another player submit).
  // This fixes the "host stuck waiting, non-host already has results" bug.
  if (playerId === room.hostId && aiScores && Object.keys(aiScores).length > 0 && room._pendingHostFinalize) {
    room._pendingHostFinalize = false;
    console.log(`[Server] Host AI scores arrived — triggering batch-finalize`);
    // Force allHaveScores = true so we fall through to batch-finalize
    allHaveScores = true;
    allHaveText = true;
  }

  // ── Batch Finalize Guard ─────────────────────────────────────
  // Prevent double-finalize: if room is already in results phase (from a prior
  // batch-finalize call), skip — all players already received their responses.
  // Return rankings so the client can display results immediately.
  if (room.phase === PHASES.RESULTS) {
    console.log(`[Server] Room already in results phase — skipping batch finalize for ${player.name}`);
    const alreadyRankings = room.players.map(p => ({
      id: p.id,
      name: p.name,
      score: room.finalNarratives[p.id]?.totalScore || 88
    }));
    alreadyRankings.sort((a, b) => b.score - a.score);
    alreadyRankings.forEach((r, idx) => { r.rank = idx + 1; });
    const myRank = alreadyRankings.find(r => r.id === playerId);
    const myPlayerResult = room.finalNarratives[playerId];
    const rubricScores = myPlayerResult?.rubricScores || null;
    const myScore = myPlayerResult?.totalScore || 88;
    // Build playerResults so client can display per-dimension scores
    const playerResults = room.players.map(p => {
      const nd = room.finalNarratives[p.id];
      const raw = nd?.aiScores || nd?.rubricScores || null;
      const rs = raw ? {
        coherence: raw.coherence || 0,
        evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
        argumentQuality: raw.argumentQuality || raw.argument || 0,
        manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
      } : null;
      return {
          id: p.id,
          name: p.name,
          score: nd?.totalScore || 0,
          rubricScores: rs,
          aiConsensus: nd?.aiConsensus || false,
          aiScores: rs
        };
    });
    return res.json({
      message: "Results already computed",
      waitingForOthers: false,
      alreadyFinalized: true,
      rankings: alreadyRankings,
      playerResults,
      myRank: myRank?.rank || null,
      myScore,
      aiConsensus: myPlayerResult?.aiConsensus || false,
      rubricScores,
      totalPlayers: room.players.length
    });
  }

  if (!allHaveScores) {
    // If ALL players have text but some are still waiting for their AI score:
    // - Check: does EVERY player already have an AI consensus score?
    // - If yes  → allHaveScores=true, fall through to batch finalize
    // - If no   → someone is still using fallback (88). Return waitingForOthers.
    //           This prevents batch-finalize from firing while host's AI score is pending.
    if (allHaveText) {
      const anyPlayerStillPendingAI = room.players.some(p =>
        !room.finalNarratives[p.id]?.totalScore && !(room.finalNarratives[p.id]?.aiConsensus === true)
      );
      if (anyPlayerStillPendingAI) {
        // Someone is still waiting for their AI score — don't run batch-finalize yet.
        // When their AI score arrives and they call /finalize, batch-finalize will fire.
        const pending = room.players.filter(p =>
          !room.finalNarratives[p.id]?.totalScore || !(room.finalNarratives[p.id]?.aiConsensus === true)
        );
        console.log(`[Server] Batch finalize deferred — players still pending AI scores: ${pending.map(p => p.name).join(", ")}`);
        // Build rankings from what we have so far (not final, just informative)
        const rankings = room.players.map(p => ({
          id: p.id,
          name: p.name,
          score: room.finalNarratives[p.id]?.totalScore || 0,
          rank: 0
        })).sort((a, b) => b.score - a.score);
        rankings.forEach((r, idx) => { r.rank = idx + 1; });
        const playerResults = room.players.map(p => {
          const nd = room.finalNarratives[p.id];
          const raw = nd?.aiScores || nd?.rubricScores || null;
          const rs = raw ? {
            coherence: raw.coherence || 0,
            evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
            argumentQuality: raw.argumentQuality || raw.argument || 0,
            manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
          } : null;
          return {
            id: p.id,
            name: p.name,
            score: nd?.totalScore || 0,
            rubricScores: rs,
            aiConsensus: nd?.aiConsensus || false,
            aiScores: rs
          };
        });
        return res.json({
          message: "Narrative recorded, waiting for AI scores from other players...",
          yourNarrative: text,
          finalizedCount: room.players.filter(p => room.finalNarratives[p.id]?.text).length,
          totalPlayers: room.players.length,
          pendingPlayers: pending.length,
          waitingForOthers: true,
          rankings,
          playerResults
        });
      }
      // All players have their AI scores — fall through to batch finalize below
    } else {
      return res.json({
        message: "Final narrative recorded",
        yourNarrative: text,
        finalizedCount: Object.keys(room.finalNarratives).length,
        totalPlayers: room.players.length,
        pendingPlayers: room.players.length - Object.keys(room.finalNarratives).length,
        waitingForOthers: true
      });
    }
  } else if (!allHaveText) {
    return res.json({
      message: "Narrative text recorded, waiting for other players...",
      yourNarrative: text,
      finalizedCount: Object.keys(room.finalNarratives).length,
      totalPlayers: room.players.length,
      pendingPlayers: room.players.length - Object.keys(room.finalNarratives).length,
      waitingForOthers: true
    });
  }

  // ── All players finalized — compute scores & rankings ─────────
  // Pre-apply rubric fallback BEFORE computing to prevent race condition:
  // if Player A (no AI scores) returns early with waitingForOthers,
  // and Player B (with AI scores) triggers batch-finalize,
  // Player A's score must already be 88 before rankings are built.
  // IMPORTANT: use totalScore === undefined (not falsy check) so GenLayer's
  // legitimate score of 0 is preserved and not overwritten with fallback 88.
  room.players.forEach(p => {
    if (room.finalNarratives[p.id].totalScore === undefined) {
      const rubric = { coherence: 22, evidenceIntegration: 22, argumentQuality: 22, manipulationResistance: 22 };
      const fallback = rubric.coherence + rubric.evidenceIntegration + rubric.argumentQuality + rubric.manipulationResistance;
      room.finalNarratives[p.id].rubricScores = rubric;
      room.finalNarratives[p.id].totalScore = fallback;
      room.finalNarratives[p.id].aiConsensus = false;
    }
  });

  // Build rankings
  const rankings = room.players.map(p => ({
    id: p.id,
    name: p.name,
    score: room.finalNarratives[p.id].totalScore,
    rank: 0
  }));
  rankings.sort((a, b) => b.score - a.score);
  rankings.forEach((r, idx) => { r.rank = idx + 1; });

  // Build per-player results with normalized scores for client display
  const playerResults = room.players.map(p => {
    const narrativeData = room.finalNarratives[p.id];
    const score = narrativeData?.totalScore || 0;
    // aiScores always uses camelCase (normalized in /finalize and /ai-result)
    // rubricScores uses camelCase (set during batch-finalize rubric fallback)
    // For AI-scored players: populate rubricScores too so the client score breakdown
    // always shows the 4-dimension breakdown even when coming from GenLayer consensus.
    // (Solo mode sets rubricScores=aiScores on client; multiplayer needs this fix.)
    const rawScores = narrativeData?.aiScores || narrativeData?.rubricScores || null;
    const rubricScores = rawScores ? {
      coherence: rawScores.coherence || 0,
      evidenceIntegration: rawScores.evidenceIntegration || rawScores.evidence || 0,
      argumentQuality: rawScores.argumentQuality || rawScores.argument || 0,
      manipulationResistance: rawScores.manipulationResistance || rawScores.manipulation || 0
    } : null;
    return {
      id: p.id,
      name: p.name,
      score,
      rubricScores,
      aiConsensus: narrativeData?.aiConsensus || false,
      aiScores: rubricScores  // same normalized values — client accepts either field
    };
  });

  // ── CRITICAL: Only advance to RESULTS if ALL players have real (non-fallback) scores ──
  // If any player has a fallback score (88 rubric), don't advance to RESULTS yet.
  // This prevents a player from prematurely showing results (with fallback 88)
  // while the host is still waiting for their AI score from GenLayer.
  // Every player must have totalScore from their OWN AI evaluation before we show results.
  // Also: do NOT set room.phase = RESULTS here. Phase only changes when the host
  // explicitly clicks "Next Phase: Challenge Window" via /advance-phase.
  // This keeps the finalizeBtn visible for the host so they can advance to challenge.
  const anyFallbackScore = room.players.some(p => {
    // Fallback user = submitted text but did NOT get an AI consensus score from GenLayer.
    // (TotalScore might be 0 or a rubric fallback was applied server-side.)
    const nd = room.finalNarratives[p.id];
    if (!nd) return false; // Player hasn't submitted text yet — not a fallback
    return !(nd.aiConsensus === true);
  });

  // Solo room (1 player): finalize immediately — no waiting for others needed.
  // Their own GenLayer score (or rubric fallback 88) is already in finalNarrative.
  // After GenLayer score arrives via /ai-result, re-rank will set phase=RESULTS.
  if (room.players.length === 1) {
    console.log(`[Server] Solo room — allFinalized for ${player.name}`);
    room.pendingRankings = rankings;
    room.pendingPlayerResults = playerResults;
    const forcedPlayerResults = rankings.map((r, i) => {
      const p = room.players.find(pl => pl.id === r.id);
      const nd = room.finalNarratives[r.id];
      const raw = nd?.aiScores || nd?.rubricScores || null;
      const rs = raw ? {
        coherence: raw.coherence || 0,
        evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
        argumentQuality: raw.argumentQuality || raw.argument || 0,
        manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
      } : null;
      return { id: r.id, name: r.name, score: r.score, rank: r.rank, rubricScores: rs, aiConsensus: nd?.aiConsensus || false, aiScores: rs };
    });
    room._forcedPlayerResults = forcedPlayerResults;
    room.phase = PHASES.EVALUATION;
    room.timeline.push({ at: new Date().toISOString(), phase: PHASES.EVALUATION, source: "batch_finalize_solo" });
    return res.json({
      message: "All narratives evaluated!",
      rankings,
      playerResults,
      totalPlayers: 1,
      myRank: rankings[0]?.rank || 1,
      myScore: rankings[0]?.score || 0,
      allFinalized: true
    });
  }

  if (anyFallbackScore) {
    // Someone is still using fallback rubric score (88).
    // DON'T advance to RESULTS — set phase to EVALUATION so waiting clients
    // can detect the phase change and re-poll. Host can still use nextPhaseBtn.
    // When the last GenLayer AI score arrives via /ai-result, re-rank will
    // advance phase to RESULTS and return allFinalized: true to all callers.
    room.phase = PHASES.EVALUATION;
    room.timeline.push({ at: new Date().toISOString(), phase: PHASES.EVALUATION, source: "batch_finalize_fallback" });
    // Store pending rankings so GET /rooms/:roomCode polling clients can access them
    // even before /ai-result fires.
    room.pendingRankings = rankings;
    room.pendingPlayerResults = playerResults;
    // Force-set pending rankings into sanitizeRoom output so client polling sees them
    const forcedPlayerResults = rankings.map((r, i) => {
      const p = room.players.find(pl => pl.id === r.id);
      const nd = room.finalNarratives[r.id];
      const raw = nd?.aiScores || nd?.rubricScores || null;
      const rs = raw ? {
        coherence: raw.coherence || 0,
        evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
        argumentQuality: raw.argumentQuality || raw.argument || 0,
        manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
      } : null;
      return { id: r.id, name: r.name, score: r.score, rank: r.rank, rubricScores: rs, aiConsensus: nd?.aiConsensus || false, aiScores: rs };
    });
    room._forcedPlayerResults = forcedPlayerResults;
    console.log(`[Server] Batch-finalize: fallback score(s) present — phase=EVALUATION, forcedPlayerResults set. Waiting for:`, room.players.filter(p => !(room.finalNarratives[p.id]?.aiConsensus)).map(p => p.name).join(", "));
    return res.json({
      message: "Narrative recorded, waiting for other players' AI scores...",
      yourNarrative: text,
      finalizedCount: room.players.filter(p => room.finalNarratives[p.id]?.totalScore !== undefined).length,
      totalPlayers: room.players.length,
      pendingPlayers: room.players.filter(p => room.finalNarratives[p.id]?.aiConsensus !== true).length,
      waitingForOthers: true,
      rankings,
      playerResults
    });
  }

  // All players have real (non-fallback) scores — return results.
  // Do NOT set room.phase = RESULTS here. Phase only advances when host
  // explicitly clicks "Next Phase: Challenge Window" in the UI.
  // This keeps the game in "evaluation" phase so the host can advance to challenge.
  const myResult = rankings.find(r => r.id === playerId);

  console.log(`[Server] All real scores received. Batch evaluation complete. Rankings:`, rankings.map(r => `${r.name}(score=${r.score}, rank=${r.rank})`).join(", "));

  res.json({
    message: "All narratives evaluated!",
    rankings,
    playerResults,
    totalPlayers: room.players.length,
    myRank: myResult?.rank || null,
    myScore: myResult?.score || 0,
    allFinalized: true
  });
});

// Browser reports GenLayer AI Consensus result (called by wallet.js after contract tx)
app.post("/rooms/:roomCode/ai-result", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  const { matchId, scores, totalScore, txHash } = req.body;
  if (!matchId) {
    res.status(400).json({ error: "matchId is required" });
    return;
  }

  console.log(`[Server] AI result for match ${matchId}: totalScore=${totalScore}, txHash=${txHash}`);

  // Update the HOST's finalNarrative entry with AI scores
  // Also clear _pendingHostFinalize so next /finalize call can run batch-finalize
  const hostId = room.hostId;
  if (hostId && room.finalNarratives[hostId]) {
    // Contract returns snake_case (evidence, argument, manipulation) — normalize to camelCase
    room.finalNarratives[hostId].aiScores = scores
      ? {
          coherence: scores.coherence || scores.coherence || 0,
          evidenceIntegration: scores.evidenceIntegration || scores.evidence || 0,
          argumentQuality: scores.argumentQuality || scores.argument || 0,
          manipulationResistance: scores.manipulationResistance || scores.manipulation || 0
        }
      : {};
    room.finalNarratives[hostId].totalScore = parseInt(totalScore) || 0;
    room.finalNarratives[hostId].aiConsensus = true;
    room._pendingHostFinalize = false;
    console.log(`[Server] Host AI scores applied to finalNarratives[${hostId}]: total=${totalScore}`);
  }

  // Update room evaluation with AI Consensus scores
  if (room.evaluation) {
    const aiScores = scores || {};
    const aiTotal = parseInt(totalScore) || 0;

    if (aiTotal > 0) {
      evaluateNarrative(room, {
        coherence: aiScores.coherence || 0,
        evidenceIntegration: aiScores.evidence || aiScores.evidenceIntegration || 0,
        argumentQuality: aiScores.argument || aiScores.argumentQuality || 0,
        manipulationResistance: aiScores.manipulation || aiScores.manipulationResistance || 0
      });

      room.evaluation = {
        ...room.evaluation,
        evaluationId: matchId,
        aiConsensus: true,
        onChain: true,
        txHash: txHash || null,
        aiScores,
        aiTotalScore: aiTotal,
        totalScore: aiTotal,
        matchId
      };
      console.log(`[Server] AI Consensus applied to room ${room.roomCode}: total=${aiTotal}`);
    }
  }

  // ── Re-rank after host AI scores arrive ───────────────────────
  // Handles case where batch-finalize ran with host=88 fallback (others finished first),
  // then host's real AI score arrives → re-sort rankings and push corrected result
  if (hostId && room.finalNarratives[hostId]) {
    const playersWithScores = room.players.filter(p => room.finalNarratives[p.id]?.totalScore !== undefined);
    const allHaveScores = playersWithScores.length === room.players.length;
    const allHaveText = room.players.every(p => room.finalNarratives[p.id]?.text);

    if (allHaveText && allHaveScores) {
      // Pre-apply rubric fallback for any still-missing scores
      // Use totalScore === undefined to preserve any real GenLayer score (even 0)
      room.players.forEach(p => {
        if (room.finalNarratives[p.id].totalScore === undefined) {
          const rubric = { coherence: 22, evidenceIntegration: 22, argumentQuality: 22, manipulationResistance: 22 };
          room.finalNarratives[p.id].rubricScores = rubric;
          room.finalNarratives[p.id].totalScore = 88;
          room.finalNarratives[p.id].aiConsensus = false;
        }
      });

      // Build playerResults and rankings for the response
      const playerResults = room.players.map(p => {
        const nd = room.finalNarratives[p.id];
        const raw = nd?.aiScores || nd?.rubricScores || null;
        const rs = raw ? {
          coherence: raw.coherence || 0,
          evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
          argumentQuality: raw.argumentQuality || raw.argument || 0,
          manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
        } : null;
        return {
          id: p.id,
          name: p.name,
          score: nd?.totalScore || 0,
          rubricScores: rs,
          aiConsensus: nd?.aiConsensus || false,
          aiScores: rs
        };
      });
      const rankings = room.players.map(p => ({
        id: p.id,
        name: p.name,
        score: room.finalNarratives[p.id]?.totalScore || 0,
        rank: 0
      })).sort((a, b) => b.score - a.score);
      rankings.forEach((r, idx) => { r.rank = idx + 1; });

      const triggerSource = room.phase === PHASES.RESULTS ? "ai_result_rerank" : "ai_result_triggered";
      if (room.phase !== PHASES.RESULTS) {
        room.phase = PHASES.RESULTS;
        room.timeline.push({ at: new Date().toISOString(), phase: PHASES.RESULTS, source: triggerSource });
      }

      console.log(`[Server] ${triggerSource === "ai_result_rerank" ? "Re-ranking" : "Batch finalize"} with host AI score. Rankings:`, rankings.map(r => `${r.name}(${r.score})`).join(", "));

      res.json({
        status: "ok",
        aiConsensus: true,
        allFinalized: true,
        rankings,
        playerResults,
        myRank: rankings.find(r => r.id === hostId)?.rank || null,
        myScore: room.finalNarratives[hostId]?.totalScore || 0,
        roomPhase: room.phase,
        reranked: triggerSource === "ai_result_rerank"
      });
      return;
    }
  }

  res.json({ status: "ok", aiConsensus: true });
});

app.post("/rooms/:roomCode/challenges", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireRoomPhase(room, [PHASES.EVALUATION, PHASES.CHALLENGE, PHASES.NEGOTIATION, PHASES.DRAFTING], res, "Challenge window is not active")) return;

  const { playerId, reason, correct } = req.body;
  if (!playerId || !reason) {
    res.status(400).json({ error: "playerId and reason are required" });
    return;
  }
  if (!findPlayer(room, playerId)) {
    res.status(404).json({ error: "Player not found in room" });
    return;
  }

  room.challengeQueue.push({
    playerId,
    reason,
    correct: Boolean(correct)
  });

  // Update local XP based on challenge result
  // (If wallet is connected, browser called Wallet.resolveChallenge() on-chain first)
  resolveChallenges(room, room.challengeQueue);

  res.status(201).json({
    message: "Challenge submitted",
    challenge: { playerId, reason, correct }
  });
});

app.get("/rooms/:roomCode/leaderboard", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!room.evaluation) {
    res.status(400).json({ error: "Finalize and evaluate the narrative first" });
    return;
  }

  const leaderboard = buildLeaderboard(room);

  // Save to global leaderboard (only best score per player, accumulate XP)
  leaderboard.forEach(entry => {
    const addr = entry.name; // use name as address for now (wallet integration later)
    const existing = globalLeaderboard.get(addr);
    if (!existing) {
      // First time — set initial score and xp
      globalLeaderboard.set(addr, {
        name: entry.name,
        score: entry.score,
        xp: entry.xp || 0
      });
    } else {
      // Update best score if higher
      if (entry.score > existing.score) {
        existing.score = entry.score;
      }
      // Accumulate XP (always add, never subtract)
      existing.xp = (existing.xp || 0) + (entry.xp || 0);
    }
  });

  res.json({
    roomCode: room.roomCode,
    scenarioSeed: room.scenarioSeed,
    finalNarrativeScore: room.evaluation.totalScore,
    leaderboard
  });
});

// ── Global Leaderboard Endpoints (On-Chain via GenLayer) ──────────────────────
app.get("/leaderboard", async (req, res) => {
  const filter = req.query.filter || "score";

  // ── Read from GenLayer contract's on-chain leaderboard ─────────────────
  // TreeMap stores: player_address → best_score (bigint)
  // get_leaderboard() returns top 20 with names from player_names TreeMap
  let contractLeaderboard = null;
  try {
    if (ENABLE_CONTRACT !== false) {
      contractLeaderboard = await contractService.getLeaderboard();
    }
  } catch(e) {
    console.warn("[Server] /leaderboard contract read failed:", e.message);
  }

  if (contractLeaderboard && Array.isArray(contractLeaderboard) && contractLeaderboard.length > 0) {
    // ── Use on-chain leaderboard ─────────────────────────────────────────────
    const entries = contractLeaderboard
      .slice(0, 100)
      .map((entry, idx) => {
        // Contract may return raw strings or already-parsed objects
        const obj = typeof entry === "string" ? JSON.parse(entry) : entry;
        return {
          rank: idx + 1,
          player_address: obj.player_address || obj.playerAddress || obj.address || "unknown",
          name: (obj.name && obj.name.length > 2) ? obj.name : "Unknown",
          score: obj.score || obj.totalScore || 0,
          xp: obj.xp || 0
        };
      });

    // Filter: score = sort by highest score, xp = sort by highest xp
    let filtered = entries;
    if (filter === "xp") {
      filtered = entries.sort((a, b) => b.xp - a.xp);
    } else {
      filtered = entries.sort((a, b) => b.score - a.score);
    }
    // Re-assign rank after sorting
    filtered = filtered.map((e, idx) => ({ ...e, rank: idx + 1 }));

    return res.json({ leaderboard: filtered, total: filtered.length, onChain: true, filter });
  }

  // ── Fallback: in-memory leaderboard (when contract unavailable) ────────
  const entries = Array.from(globalLeaderboard.entries())
    .map(([addr, data]) => ({
      rank: 0,
      player_address: addr,
      name: data.name,
      score: data.score,
      xp: data.xp || 0
    }))
    .sort((a, b) => filter === "xp" ? b.xp - a.xp : b.score - a.score)
    .slice(0, 100)
    .map((e, idx) => ({ ...e, rank: idx + 1 }));

  res.json({ leaderboard: entries, total: entries.length, onChain: false, filter });
});

app.get("/leaderboard/player/:address", async (req, res) => {
  // ── Read from GenLayer contract ─────────────────────────────────────────
  if (ENABLE_CONTRACT !== false) {
    try {
      const profile = await contractService.getPlayerProfile(req.params.address);
      if (profile && typeof profile === "object") {
        return res.json({
          player_address: req.params.address,
          name: profile.name || "Unknown",
          score: profile.score || 0,
          xp: profile.xp || 0,
          gamesPlayed: profile.games_played || 0,
          onChain: true
        });
      }
    } catch(e) {
      console.warn("[Server] /leaderboard/player contract read failed:", e.message);
    }
  }

  // Fallback: in-memory
  const data = globalLeaderboard.get(req.params.address);
  if (!data) {
    return res.json({ player_address: req.params.address, score: 0, rank: null, gamesPlayed: 0 });
  }
  const sorted = Array.from(globalLeaderboard.values()).sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex(e => e.score === data.score && e.name === data.name) + 1;
  res.json({
    player_address: req.params.address,
    name: data.name,
    score: data.score,
    rank,
    gamesPlayed: data.gamesPlayed
  });
});

app.post("/rooms/:roomCode/advance-phase", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireHost(room, req.body.hostId, res)) return;

  const currentIndex = PHASE_ORDER.indexOf(room.phase);
  if (currentIndex === -1) {
    res.status(400).json({ error: "Unknown current phase" });
    return;
  }
  if (currentIndex >= PHASE_ORDER.length - 1) {
    // Already at final phase (results) — room stays active but can't advance further
    res.json({ message: "Already at final phase", phase: room.phase, atEnd: true });
    return;
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1];

  // If countdown is still running and not expired yet, kick late players first
  if (!room.speedMode && room.players.length > 1 && room.waitingForReady) {
    const remaining = getReadyRemainingSeconds(room);
    if (remaining > 0) {
      // Countdown still running — host must wait or players must ready up
      const readied = room.readiedPlayers ? room.readiedPlayers.size : room.players.filter(p => p.ready).length;
      res.status(400).json({
        error: `Countdown active: ${remaining}s left. ${readied}/${room.players.length} players ready. Wait or retry.`,
        waitingForReady: true,
        readiedCount: readied,
        totalPlayers: room.players.length,
        remainingSeconds: remaining
      });
      return;
    }
    // remaining === 0 — countdown expired, kick not-ready players (NOT the host!)
    const kicked = kickNotReady(room);
    // Never kick the host — they trigger the countdown, they can't kick themselves
    const kickedNonHost = kicked.filter(p => p.id !== room.hostId);
    if (kickedNonHost.length > 0) {
      console.log(`[Server] Kicked ${kickedNonHost.length} not-ready players:`, kickedNonHost.map(p => p.name));
    }
    // Restore host to players if they were kicked (shouldn't happen but guard anyway)
    if (!room.players.find(p => p.id === room.hostId)) {
      const hostWasKicked = kicked.find(p => p.id === room.hostId);
      if (hostWasKicked) {
        room.players.push(hostWasKicked);
        console.log(`[Server] Restored host ${hostWasKicked.name} to room — host cannot be kicked by READY system`);
      }
    }
  }

  // Advance phase (reset ready state from previous countdown if any)
  resetReady(room);
  room.waitingForReady = false;
  room.phase = nextPhase;
  room.timeline.push({ at: new Date().toISOString(), phase: nextPhase, source: "host_advance" });
  startPhaseTimer(room, nextPhase, room.players.length);
  console.log(`[Server] Phase advanced to ${nextPhase} in room ${room.roomCode}. Players: ${room.players.length} — ${room.players.map(p => p.name).join(", ")}`);
  res.json({ message: "Phase advanced", phase: room.phase, timer: room.phaseTimers[nextPhase] });
});

// Host starts the ready countdown — 10s for all players to click READY or get kicked
app.post("/rooms/:roomCode/start-ready-countdown", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireHost(room, req.body.hostId, res)) return;

  if (room.waitingForReady && getReadyRemainingSeconds(room) > 0) {
    const remaining = getReadyRemainingSeconds(room);
    res.status(400).json({
      error: `Countdown already running: ${remaining}s remaining`,
      remainingSeconds: remaining
    });
    return;
  }

  startReadyCountdown(room);
  room.waitingForReady = true;
  console.log(`[Server] Ready countdown started in room ${room.roomCode}. Players: ${room.players.length}`);
  res.json({
    message: "Countdown started — 10s for all players to ready up!",
    waitingForReady: true,
    remainingSeconds: 10,
    totalPlayers: room.players.length
  });
});

// Player clicks Ready — marks themselves ready for next phase
app.post("/rooms/:roomCode/player-ready", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  const { playerId } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found in room" });
    return;
  }

  markReady(room, playerId);
  console.log(`[Server] Player ${player.name} is ready in room ${room.roomCode}. ${room.readiedPlayers.size}/${room.players.length}`);

  res.json({
    status: "ok",
    playerId,
    readiedCount: room.readiedPlayers.size,
    totalPlayers: room.players.length,
    allReady: allPlayersReady(room),
    remainingSeconds: getReadyRemainingSeconds(room)
  });
});

// Get ready status for the current phase
app.get("/rooms/:roomCode/ready-status", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  res.json({
    readiedCount: room.readiedPlayers ? room.readiedPlayers.size : 0,
    totalPlayers: room.players.length,
    allReady: allPlayersReady(room),
    remainingSeconds: getReadyRemainingSeconds(room),
    players: room.players.map(p => ({ id: p.id, name: p.name, ready: p.ready }))
  });
});

// Get current timer status
app.get("/rooms/:roomCode/timer", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  const remaining = getPhaseRemainingSeconds(room);
  res.json({
    phase: room.phase,
    remainingSeconds: remaining,
    timer: room.phaseTimers[room.phase] || null,
    allSubmitted: allPlayersSubmitted(room),
    submittedCount: (room.submissionsPerPhase[room.phase] || []).length,
    totalPlayers: room.players.length,
    speedMode: room.speedMode
  });
});

// Auto-advance check (for polling or hook)
app.post("/rooms/:roomCode/check-auto-advance", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;

  if (!room.speedMode) {
    res.json({ autoAdvance: false, reason: "speedMode is off" });
    return;
  }

  const remaining = getPhaseRemainingSeconds(room);
  const timedOut = remaining !== null && remaining <= 0;
  const allDone = allPlayersSubmitted(room);

  if (!timedOut && !allDone) {
    res.json({ autoAdvance: false, remainingSeconds: remaining, allSubmitted: allDone });
    return;
  }

  // Auto advance to next phase
  const currentIndex = PHASE_ORDER.indexOf(room.phase);
  if (currentIndex === -1 || currentIndex === PHASE_ORDER.length - 1) {
    res.json({ autoAdvance: false, reason: "already at final phase" });
    return;
  }

  const nextPhase = PHASE_ORDER[currentIndex + 1];
  room.phase = nextPhase;
  room.timeline.push({ at: new Date().toISOString(), phase: nextPhase, source: "auto_advance" });
  startPhaseTimer(room, nextPhase, room.players.length);

  res.json({
    autoAdvance: true,
    fromPhase: PHASE_ORDER[currentIndex],
    toPhase: nextPhase,
    trigger: timedOut ? "timeout" : "all_submitted",
    timer: room.phaseTimers[nextPhase]
  });
});

app.post("/rooms/:roomCode/close-challenge", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  if (!requireHost(room, req.body.hostId, res)) return;
  if (!requireRoomPhase(room, [PHASES.EVALUATION, PHASES.CHALLENGE], res, "Challenge window is not open")) return;

  const leaderboard = buildLeaderboard(room);
  res.json({
    message: "Challenge window closed",
    phase: room.phase,
    leaderboard
  });
});

app.get("/rooms/:roomCode", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  res.json(sanitizeRoom(room));
});

// Debug endpoint — shows raw room state for diagnosing stuck waiting issues
app.get("/rooms/:roomCode/debug", (req, res) => {
  const room = getRoomOr404(req, res);
  if (!room) return;
  const playerStates = room.players.map(p => {
    const fn = room.finalNarratives[p.id];
    return {
      id: p.id, name: p.name, isHost: p.id === room.hostId,
      hasText: !!fn?.text,
      totalScore: fn?.totalScore,
      aiConsensus: fn?.aiConsensus,
      hasAiScores: !!fn?.aiScores,
    };
  });
  res.json({
    roomCode: room.roomCode, phase: room.phase,
    players: playerStates,
    allHaveText: room.players.every(p => room.finalNarratives[p.id]?.text),
    allHaveScores: room.players.filter(p => room.finalNarratives[p.id]?.totalScore !== undefined).length,
    totalPlayers: room.players.length,
    _pendingHostFinalize: room._pendingHostFinalize
  });
});

// ── Contract Proxy Endpoints ─────────────────────────────────────────────────
// All calls are signed by the server wallet (PRIVATE_KEY env var).
// Frontend passes player wallet address for audit logging only.

app.get("/api/contract/player/:address", async (req, res) => {
  try {
    const { getPlayerName } = contractService;
    const name = await getPlayerName(req.params.address);
    res.json({ player_address: req.params.address, name: name || "" });
  } catch (err) {
    console.error("[API] /api/contract/player error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/contract/leaderboard", async (req, res) => {
  try {
    const { getLeaderboard } = contractService;
    const leaderboard = await getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    console.error("[API] /api/contract/leaderboard error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contract/set-player-name", async (req, res) => {
  try {
    const { name, player_address } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "name is required" });
    }
    const { setPlayerName } = contractService;
    const result = await setPlayerName(name, player_address || "unknown");

    // IMPORTANT: Contract stores name under SERVER wallet address (gl.message.sender_address),
    // NOT player address. So we return the name directly from the request as confirmation.
    // The on-chain storage is keyed by server address, not player address.
    // For player name persistence, we rely on localStorage + this API endpoint.
    res.json({
      status: "ok",
      name,
      player_address,
      result,
      note: "Name stored in localStorage. On-chain storage uses server wallet as key."
    });
  } catch (err) {
    console.error("[API] /api/contract/set-player-name error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contract/evaluate", async (req, res) => {
  try {
    const { match_id, scenario_id, narrative, fragments, contributions, player_address } = req.body;
    if (!match_id || !narrative) {
      return res.status(400).json({ error: "match_id and narrative are required" });
    }
    const { evaluateMatch } = contractService;
    const result = await evaluateMatch(
      match_id,
      scenario_id || "default",
      narrative,
      fragments || [],
      contributions || [],
      player_address || "unknown"
    );
    res.json({ status: "ok", result });
  } catch (err) {
    console.error("[API] /api/contract/evaluate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contract/resolve-challenge", async (req, res) => {
  try {
    const { evaluation_id, challenge_reason, challenge_valid, player_address } = req.body;
    if (!evaluation_id || challenge_valid === undefined) {
      return res.status(400).json({ error: "evaluation_id and challenge_valid are required" });
    }
    const { resolveChallenge } = contractService;
    const result = await resolveChallenge(
      evaluation_id,
      challenge_reason || "",
      Boolean(challenge_valid),
      player_address || "unknown"
    );
    res.json({ status: "ok", result });
  } catch (err) {
    console.error("[API] /api/contract/resolve-challenge error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Generic Contract Read/Write ─────────────────────────────────────────────────

app.post("/api/contract/read/:method", async (req, res) => {
  try {
    const { contractRead } = contractService;
    const result = await contractRead(req.params.method, req.body.args || []);
    res.json({ result });
  } catch (err) {
    console.error(`[API] /api/contract/read/${req.params.method} error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/contract/write", async (req, res) => {
  try {
    const { contractWrite } = contractService;
    const { method, args, player_address } = req.body;
    if (!method) return res.status(400).json({ error: "method is required" });
    console.log(`[API] /api/contract/write ${method} by ${player_address}`);
    const result = await contractWrite(method, args || []);
    res.json({ status: "ok", result });
  } catch (err) {
    console.error("[API] /api/contract/write error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────

// Reset in-memory leaderboard
app.post("/admin/reset-leaderboard", (req, res) => {
  globalLeaderboard.clear();
  console.log("[Admin] Leaderboard reset. All entries cleared.");
  res.json({ status: "ok", message: "Leaderboard has been reset" });
});

// ── Init ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

// Initialize server wallet (optional — writes won't work without it)
contractService.initWriteClient().then(addr => {
  if (addr) {
    console.log(`[Server] Contract wallet: ${addr}`);
    console.log(`[Server] Contract address: ${contractService.CONTRACT_ADDRESS}`);
  }
}).catch(err => {
  console.warn(`[Server] Contract wallet init failed (writes disabled): ${err.message}`);
});

app.listen(PORT, () => {
  console.log(`Patchwork Truth API running on port ${PORT}`);
});