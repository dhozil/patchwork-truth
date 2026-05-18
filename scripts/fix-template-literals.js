const fs = require('fs');
let src = fs.readFileSync('./public/main.js', 'utf8');
const backtick = '\x60';

const patterns = [
  [backtick + '/rooms/${roomCode}/timer' + backtick, '"/rooms/" + roomCode + "/timer"'],
  [backtick + '/rooms/${roomCode}/player-ready' + backtick, '"/rooms/" + roomCode + "/player-ready"'],
  [backtick + '/rooms/${roomCode}/start' + backtick, '"/rooms/" + roomCode + "/start"'],
  [backtick + '/rooms/${roomCode}/contributions' + backtick, '"/rooms/" + roomCode + "/contributions"'],
  [backtick + '/rooms/${roomCode}/finalize' + backtick, '"/rooms/" + roomCode + "/finalize"'],
  [backtick + '/rooms/${roomCode}/ai-result' + backtick, '"/rooms/" + roomCode + "/ai-result"'],
  [backtick + '/rooms/${roomCode}/challenges' + backtick, '"/rooms/" + roomCode + "/challenges"'],
  [backtick + '/rooms/${roomCode}/close-challenge' + backtick, '"/rooms/" + roomCode + "/close-challenge"'],
  [backtick + '/rooms/${roomCode}/advance-phase' + backtick, '"/rooms/" + roomCode + "/advance-phase"'],
  [backtick + 'match_${roomCode}_${Date.now()}' + backtick, '"match_" + roomCode + "_" + Date.now()'],
  [backtick + '${API_BASE}/rooms/${roomCode}/advance-phase' + backtick, 'API_BASE + "/rooms/" + roomCode + "/advance-phase"'],
  [backtick + '${window.location.origin}${window.location.pathname}?join=${roomCode}&name=' + backtick, 'window.location.origin + window.location.pathname + "?join=" + roomCode + "&name="'],
  [backtick + 'Patchwork Truth — Room ${roomCode} | Score: ${' + backtick, '"Patchwork Truth — Room " + roomCode + " | Score: " +'],
];

let total = 0;
for (const [from, to] of patterns) {
  const before = src;
  src = src.split(from).join(to);
  const replaced = (before.split(from).length - 1) - (src.split(from).length - 1);
  if (before !== src) {
    console.log('Replaced', before.split(from).length - src.split(from).length, 'x:', JSON.stringify(from));
    total++;
  }
}

fs.writeFileSync('./public/main.js', src);
console.log('Total patterns fixed:', total);