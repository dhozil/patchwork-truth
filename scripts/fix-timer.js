const fs = require('fs');
let src = fs.readFileSync('./public/main.js', 'utf8');
const t = '\x60'; // backtick
const d = '\x22'; // double quote

// The bug: template literal opens with backtick but closes with double quote
// Pattern: `.../timer"  ->  should be:  `.../timer`
// Scan for this and fix
let count = 0;
src = src.split(t + '/rooms/${roomCode}/timer' + d).join(t + '/rooms/${roomCode}/timer' + t);
if (src.includes(t + '/rooms/${roomCode}/timer' + d)) {
  console.log('Still has broken pattern');
  count = -1;
} else {
  console.log('Fixed timer pattern');
  count = 1;
}

fs.writeFileSync('./public/main.js', src);
console.log('Done, count:', count);