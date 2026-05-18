const { createPlayer, createRoom } = require("./game/state");
const {
  distributeFragments,
  runNegotiation,
  finalizeNarrative,
  evaluateNarrative,
  resolveChallenges,
  buildLeaderboard
} = require("./game/engine");
const { fragments, contributions, challenges, rubric } = require("./game/sampleData");

const players = [
  createPlayer("p1", "Alya"),
  createPlayer("p2", "Bima"),
  createPlayer("p3", "Citra"),
  createPlayer("p4", "Danu"),
  createPlayer("p5", "Eka")
];

const room = createRoom({
  roomCode: "GENLAYER01",
  hostId: "p1",
  players,
  scenarioSeed: "week-19-2026"
});

distributeFragments(room, fragments);
runNegotiation(room, contributions);
finalizeNarrative(
  room,
  "Signal spike occurred during sensor instability, while camera blackout created uncertainty that required cautious consensus."
);
evaluateNarrative(room, rubric);
resolveChallenges(room, challenges);

const leaderboard = buildLeaderboard(room);

console.log("[Patchwork Truth] MVP match simulation complete.");
console.log(`Room: ${room.roomCode} | Seed: ${room.scenarioSeed}`);
console.log(`Final Narrative Score: ${room.evaluation.totalScore}/100`);
console.log("Leaderboard:");
leaderboard.forEach((row) => {
  console.log(`#${row.rank} ${row.name} | score=${row.score} | xp=${row.xp}`);
});

