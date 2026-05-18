const { calculatePlayerScore, calculateXp, buildScoreBreakdown } = require("./scoring");

const PHASES = {
  LOBBY: "lobby",
  DISTRIBUTION: "fragment_distribution",
  NEGOTIATION: "negotiation",
  DRAFTING: "drafting",
  EVALUATION: "ai_evaluation",
  CHALLENGE: "challenge_window",
  RESULTS: "results"
};

function setPhase(room, phase) {
  room.phase = phase;
  room.timeline.push({ at: new Date().toISOString(), phase });
}

function distributeFragments(room, fragmentPool) {
  setPhase(room, PHASES.DISTRIBUTION);
  room.players.forEach((player, idx) => {
    player.fragments = [
      fragmentPool[idx % fragmentPool.length],
      fragmentPool[(idx + 2) % fragmentPool.length]
    ];
  });
}

function runNegotiation(room, contributionDrafts) {
  setPhase(room, PHASES.NEGOTIATION);
  room.players.forEach((player) => {
    player.contributions = contributionDrafts
      .filter((draft) => draft.playerId === player.id)
      .map((draft) => ({
        text: draft.text,
        accepted: draft.accepted
      }));
  });
}

function finalizeNarrative(room, text) {
  setPhase(room, PHASES.DRAFTING);
  room.finalNarrative = text;
}

function evaluateNarrative(room, rubricScores) {
  setPhase(room, PHASES.EVALUATION);
  const total =
    rubricScores.coherence +
    rubricScores.evidenceIntegration +
    rubricScores.argumentQuality +
    rubricScores.manipulationResistance;

  room.evaluation = {
    rubricScores,
    totalScore: total
  };
}

function resolveChallenges(room, challengeDecisions) {
  setPhase(room, PHASES.CHALLENGE);
  room.players.forEach((player) => {
    player.challenges = challengeDecisions
      .filter((item) => item.playerId === player.id)
      .map((item) => ({
        reason: item.reason,
        correct: item.correct
      }));
  });
}

function buildLeaderboard(room) {
  setPhase(room, PHASES.RESULTS);
  const withScore = room.players.map((player) => ({
    ...player,
    score: calculatePlayerScore(player)
  }));

  withScore.sort((a, b) => b.score - a.score);
  return withScore.map((player, idx) => ({
    rank: idx + 1,
    playerId: player.id,
    name: player.name,
    score: player.score,
    xp: calculateXp(player.score, idx + 1, withScore.length),
    breakdown: buildScoreBreakdown(player)
  }));
}

module.exports = {
  PHASES,
  distributeFragments,
  runNegotiation,
  finalizeNarrative,
  evaluateNarrative,
  resolveChallenges,
  buildLeaderboard
};

