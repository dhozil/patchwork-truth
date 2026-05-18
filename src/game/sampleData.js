const fragments = [
  "Witness A saw the device activated at 19:05.",
  "System log shows a signal spike at 19:07.",
  "Anonymous report claims the signal was staged.",
  "Camera feed dropped for exactly 40 seconds.",
  "Maintenance ticket confirms a sensor fault that day.",
  "Audit notes indicate two manual overrides."
];

const contributions = [
  { playerId: "p1", text: "Use log spike as central timeline.", accepted: true },
  { playerId: "p1", text: "Ignore anonymous report.", accepted: false },
  { playerId: "p2", text: "Include camera blackout as uncertainty.", accepted: true },
  { playerId: "p3", text: "Link sensor fault with manual override.", accepted: true },
  { playerId: "p4", text: "Call event purely staged.", accepted: false },
  { playerId: "p5", text: "Mention witness timing mismatch.", accepted: true }
];

const challenges = [
  { playerId: "p2", reason: "Anonymous report was overweighted.", correct: true },
  { playerId: "p4", reason: "Camera blackout should be discarded.", correct: false },
  { playerId: "p5", reason: "Manual override evidence is strong.", correct: true }
];

const rubric = {
  coherence: 23,
  evidenceIntegration: 24,
  argumentQuality: 21,
  manipulationResistance: 20
};

module.exports = {
  fragments,
  contributions,
  challenges,
  rubric
};

