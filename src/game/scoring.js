function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculatePlayerScore(player) {
  const acceptedContributions = player.contributions.filter((item) => item.accepted).length;
  const accurateChallenges = player.challenges.filter((item) => item.correct).length;
  const failedChallenges = player.challenges.filter((item) => !item.correct).length;

  const rawScore =
    acceptedContributions * 18 +
    accurateChallenges * 14 -
    failedChallenges * 6;

  return clamp(rawScore, 0, 100);
}

function calculateXp(playerScore, rank, totalPlayers) {
  const topCutoff = Math.ceil(totalPlayers * 0.2);
  const midCutoff = Math.ceil(totalPlayers * 0.8);

  if (rank <= topCutoff) return 120 + playerScore;
  if (rank <= midCutoff) return 75 + Math.floor(playerScore * 0.6);
  return 35 + Math.floor(playerScore * 0.3);
}

function buildScoreBreakdown(player) {
  const acceptedContributions = player.contributions.filter((item) => item.accepted).length;
  const accurateChallenges = player.challenges.filter((item) => item.correct).length;
  const failedChallenges = player.challenges.filter((item) => !item.correct).length;
  const contributionPoints = acceptedContributions * 18;
  const challengeBonus = accurateChallenges * 14;
  const challengePenalty = failedChallenges * 6;

  return {
    acceptedContributions,
    accurateChallenges,
    failedChallenges,
    contributionPoints,
    challengeBonus,
    challengePenalty,
    summary: `+${contributionPoints} dari kontribusi diterima, +${challengeBonus} dari challenge akurat, -${challengePenalty} dari challenge gagal`
  };
}

module.exports = {
  calculatePlayerScore,
  calculateXp,
  buildScoreBreakdown
};

