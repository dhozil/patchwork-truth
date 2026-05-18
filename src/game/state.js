function createPlayer(id, name) {
  return {
    id,
    name,
    fragments: [],
    contributions: [],
    challenges: [],
    score: 0,
    xp: 0,
    ready: false
  };
}

function createRoom({ roomCode, hostId, players, scenarioSeed, speedMode }) {
  return {
    roomCode,
    hostId,
    players,
    scenarioSeed,
    speedMode: speedMode || false,
    phase: "lobby",
    timeline: [],
    finalNarratives: {},  // playerId → { text, score, aiConsensus, rubricScores }
    submissions: [],
    challengeQueue: [],
    phaseTimers: {},           // phase -> { startedAt, durationSeconds }
    submissionsPerPhase: {},   // phase -> [playerIds who submitted]
    match: {
      startedAt: null,
      durationMinutes: null,
      endsAt: null
    },
    // Ready system — countdown starts when host triggers advance
    // Players must click READY or be kicked after countdown expires
    waitingForReady: false,      // true = countdown active, waiting for players
    readyTimeout: null,          // { startedAt, durationSeconds } — 10s for players to click
    readiedPlayers: new Set(),   // track which players have clicked ready
    kickedFromRoom: []           // players who were kicked (for notification)
  };
}

// Speed mode: dynamic timer based on player count
function getPhaseDurationSeconds(phase, playerCount, speedMode) {
  if (!speedMode) {
    // Normal mode defaults
    switch (phase) {
      case "fragment_distribution": return 90;   // 1.5 min
      case "negotiation": return 180;            // 3 min
      case "final_drafting": return 120;         // 2 min
      case "ai_evaluation": return 60;          // 1 min
      case "challenge_window": return 120;        // 2 min
      default: return 60;
    }
  }
  // Speed mode: shorter, scales with player count
  const base = Math.max(15, 45 - playerCount * 5); // fewer players = shorter
  switch (phase) {
    case "fragment_distribution": return base;
    case "negotiation": return base * 2;
    case "final_drafting": return base;
    case "ai_evaluation": return 20;
    case "challenge_window": return base;
    default: return base;
  }
}

// Count submitted players in current phase
function countSubmissions(room, playerIds) {
  const phase = room.phase;
  return (room.submissionsPerPhase[phase] || []).filter(id => playerIds.includes(id)).length;
}

// Check if all players have submitted
function allPlayersSubmitted(room) {
  const phase = room.phase;
  const phaseSubmissions = room.submissionsPerPhase[phase] || [];
  return room.players.every(p => phaseSubmissions.includes(p.id));
}

// Mark player submitted in current phase
function markSubmitted(room, playerId) {
  const phase = room.phase;
  if (!room.submissionsPerPhase[phase]) room.submissionsPerPhase[phase] = [];
  if (!room.submissionsPerPhase[phase].includes(playerId)) {
    room.submissionsPerPhase[phase].push(playerId);
  }
}

// Get remaining seconds for current phase
function getPhaseRemainingSeconds(room) {
  const timer = room.phaseTimers[room.phase];
  if (!timer) return null;
  const elapsed = (Date.now() - new Date(timer.startedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(timer.durationSeconds - elapsed));
}

// Start phase timer
function startPhaseTimer(room, phase, playerCount) {
  room.phaseTimers[phase] = {
    startedAt: new Date().toISOString(),
    durationSeconds: getPhaseDurationSeconds(phase, playerCount, room.speedMode)
  };
}

// ── Ready system ────────────────────────────────────────────────

// Start 10-second ready countdown for all players
// Called when host triggers advance-phase — players must click READY or be kicked
function startReadyCountdown(room) {
  room.readyTimeout = {
    startedAt: new Date().toISOString(),
    durationSeconds: 10
  };
  room.readiedPlayers = new Set();
  room.players.forEach(p => { p.ready = false; });
  room.waitingForReady = true;
}

// Mark a player as ready
function markReady(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.ready = true;
    room.readiedPlayers.add(playerId);
  }
}

// Check if all players have clicked ready
function allPlayersReady(room) {
  return room.players.every(p => p.ready);
}

// Get remaining ready seconds
function getReadyRemainingSeconds(room) {
  if (!room.readyTimeout) return null;
  const elapsed = (Date.now() - new Date(room.readyTimeout.startedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(room.readyTimeout.durationSeconds - elapsed));
}

// Kick players who are not ready after countdown expires
// Host is NEVER kicked — they trigger the countdown and must always remain
function kickNotReady(room) {
  const remaining = getReadyRemainingSeconds(room);
  if (remaining !== 0) return [];
  // Exclude host from kicking — only non-host players can be kicked for not readying
  const kicked = room.players.filter(p => !p.ready && p.id !== room.hostId);
  room.players = room.players.filter(p => p.ready || p.id === room.hostId);
  // Reset ready state
  room.readyTimeout = null;
  room.readiedPlayers = new Set();
  room.players.forEach(p => { p.ready = false; });
  return kicked;
}

// Reset ready status when phase changes
function resetReady(room) {
  room.readyTimeout = null;
  room.readiedPlayers = new Set();
  room.players.forEach(p => { p.ready = false; });
}

module.exports = {
  createPlayer,
  createRoom,
  getPhaseDurationSeconds,
  countSubmissions,
  allPlayersSubmitted,
  markSubmitted,
  getPhaseRemainingSeconds,
  startPhaseTimer,
  startReadyCountdown,
  markReady,
  allPlayersReady,
  getReadyRemainingSeconds,
  kickNotReady,
  resetReady
};

