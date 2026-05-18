const fs = require('fs');

// Translate index.html
let html = fs.readFileSync('D:/Game/patchwork-truth/public/index.html', 'utf8');
const htmlReplacements = [
  // Intro tagline
  ['Rangkai kebenaran bersama dari potongan cerita yang saling bertentangan.<br>\n        Siapa yang paling bisa membangun narasi yang koheren dan adil?', 'Weave truth together from conflicting story fragments.<br>\n        Who can build the most coherent and fair narrative?'],
  // Feature cards
  ['<h3>Kumpulkan Bukti</h3>', '<h3>Collect Evidence</h3>'],
  ['<p>Tiap pemain dapat fragmen cerita berbeda. Gabungkan yang valid.</p>', '<p>Each player gets different story fragments. Combine the valid ones.</p>'],
  ['<h3>Negosiasi</h3>', '<h3>Negotiate</h3>'],
  ['<p>Diskusi dan rangkai narasi final bersama tim dalam waktu terbatas.</p>', '<p>Discuss and weave the final narrative with your team under a time limit.</p>'],
  ['<h3>AI Evaluator</h3>', '<h3>AI Evaluator</h3>'],
  ['<p>Intelligent Contract menilai koherensi, integrasi bukti, dan kualitas argumen.</p>', '<p>Intelligent Contract grades coherence, evidence integration, and argument quality.</p>'],
  ['<h3>Challenge</h3>', '<h3>Challenge</h3>'],
  ['<p>Optimistic Democracy: ajukan banding jika tidak setuju dengan penilaian.</p>', '<p>Optimistic Democracy: appeal if you disagree with the AI evaluation.</p>'],
  // Name input
  ['placeholder="Masukkan nama kamu..."', 'placeholder="Enter your name..."'],
  // Play button
  ['<button class="btn-play" id="playBtn">Mulai Main</button>', '<button class="btn-play" id="playBtn">Play</button>'],
  // Demo button
  ['<button class="btn-play" style="background: linear-gradient(120deg,#6a1b9a,#8f7bff); margin-top:10px; font-size:13px; padding:11px 30px;" id="demoBtn">&#9654; Tonton Demo Otomatis</button>', '<button class="btn-play" style="background: linear-gradient(120deg,#6a1b9a,#8f7bff); margin-top:10px; font-size:13px; padding:11px 30px;" id="demoBtn">&#9654; Watch Auto Demo</button>'],
  // Footer
  ['Dibuat untuk <span>GenLayer Program Builder</span> &mdash; 5-15 menit &mdash; Solo &amp; Multiplayer', 'Made for <span>GenLayer Program Builder</span> &mdash; 5-15 min &mdash; Solo &amp; Multiplayer'],
  // Game header
  ['<button class="btn-back" id="backBtn">&#8592; Room Baru</button>', '<button class="btn-back" id="backBtn">&#8592; New Room</button>'],
  // Fragments panel
  ['<h3><span class="icon">&#128270;</span> Fragmen Ceritamu</h3>', '<h3><span class="icon">&#128270;</span> Your Story Fragments</h3>'],
  ['<p style="font-size:12px; color:var(--muted); margin:0 0 10px;">Gunakan fragmen ini untuk menulis kontribusi.</p>', '<p style="font-size:12px; color:var(--muted); margin:0 0 10px;">Use these fragments to write your contribution.</p>'],
  ['<button class="btn" id="continueToContributionBtn">Lanjut ke Kontribusi &#8594;</button>', '<button class="btn" id="continueToContributionBtn">Next to Contribution &#8594;</button>'],
  // Contribution panel
  ['<div class="action-title">1. Tulis Kontribusimu</div>', '<div class="action-title">1. Write Your Contribution</div>'],
  ['<div class="action-desc">Buat klaim berdasarkan bukti yang kamu punya. Tulis 1-2 kalimat yang menjelaskan klaim utama + bukti pendukung.</div>', '<div class="action-desc">Make a claim based on your evidence. Write 1-2 sentences explaining the main claim + supporting evidence.</div>'],
  ['placeholder="Contoh: Signal spike pada 19:07 adalah bukti kuat bahwa insiden dimulai sebelum blackout kamera. Saya yakin ini harus menjadi timeline utama."', 'placeholder="Example: The signal spike at 19:07 is strong evidence the incident started before the camera blackout. I believe this should be the main timeline."'],
  ['<div class="helper-text">Format: klaim + bukti + dampak ke narasi final</div>', '<div class="helper-text">Format: claim + evidence + narrative impact</div>'],
  ['<option value="true">&#10004; Diterima (Accepted)</option>', '<option value="true">&#10004; Accepted</option>'],
  ['<option value="false">&#10006; Ditolak (Rejected)</option>', '<option value="false">&#10006; Rejected</option>'],
  ['<button class="btn btn-half" id="submitContributionBtn">Kirim Kontribusi</button>', '<button class="btn btn-half" id="submitContributionBtn">Submit Contribution</button>'],
  // Finalize panel
  ['<div class="action-title">2. Tulis Narasi Final</div>', '<div class="action-title">2. Write the Final Narrative</div>'],
  ['<div class="action-desc">Rangkum bukti-bukti paling kuat ke dalam 1-2 kalimat narasi final. Akui bagian yang belum pasti.</div>', '<div class="action-desc">Summarize the strongest evidence into 1-2 sentences. Acknowledge uncertain parts.</div>'],
  ['placeholder="Contoh: Insiden kemungkinan terjadi saat anomali sensor dan signal spike, namun blackout kamera menambah ketidakpastian sehingga klaim manipulasi perlu dibatasi."', 'placeholder="Example: The incident likely occurred during the sensor anomaly and signal spike, but the camera blackout adds uncertainty so manipulation claims must be limited."'],
  ['<div class="helper-text">Format: ringkas + bukti kuat + akui ketidakpastian</div>', '<div class="helper-text">Format: summarize + strong evidence + acknowledge uncertainty</div>'],
  ['<button class="btn btn-ok" id="finalizeBtn">Finalisasi Narasi &#10004;</button>', '<button class="btn btn-ok" id="finalizeBtn">Finalize Narrative &#10004;</button>'],
  // Challenge panel
  ['<div class="action-title">3. Ajukan Challenge (Opsional)</div>', '<div class="action-title">3. Submit a Challenge (Optional)</div>'],
  ['<div class="action-desc">Jika kamu tidak setuju dengan evaluasi AI, ajukan banding dengan alasan.</div>', '<div class="action-desc">If you disagree with the AI evaluation, submit an appeal with a reason.</div>'],
  ['placeholder="Contoh: Evaluasi AI terlalu menekankan pada manipulasiResistance padahal bukti signal spike sudah sangat kuat."', 'placeholder="Example: The AI evaluation over-emphasized manipulationResistance even though the signal spike evidence was very strong."'],
  ['<div class="helper-text">Opsional &mdash; boleh kosong</div>', '<div class="helper-text">Optional &mdash; can be left empty</div>'],
  ['<option value="true">&#10004; Challenge Benar</option>', '<option value="true">&#10004; Correct Challenge</option>'],
  ['<option value="false">&#10006; Challenge Salah</option>', '<option value="false">&#10006; Incorrect Challenge</option>'],
  ['<button class="btn btn-warn btn-half" id="submitChallengeBtn">Kirim Challenge</button>', '<button class="btn btn-warn btn-half" id="submitChallengeBtn">Submit Challenge</button>'],
  // Results panel
  ['<h3><span class="icon">&#127941;</span> Hasil Akhir</h3>', '<h3><span class="icon">&#127941;</span> Final Results</h3>'],
  ['<button class="btn btn-warn" id="showLeaderboardBtn" style="margin-bottom:10px;">Tampilkan Leaderboard &#8594;</button>', '<button class="btn btn-warn" id="showLeaderboardBtn" style="margin-bottom:10px;">Show Leaderboard &#8594;</button>'],
  // Leaderboard panel
  ['<h3><span class="icon">&#128202;</span> Leaderboard</h3>', '<h3><span class="icon">&#128202;</span> Leaderboard</h3>'],
  ['<div style="font-size:13px; font-weight:700; color:#d7e2ff; margin-bottom:6px;">Kenapa Kamu Dapat Skor Ini?</div>', '<div style="font-size:13px; font-weight:700; color:#d7e2ff; margin-bottom:6px;">Why Did You Get This Score?</div>'],
  ['<button class="btn" id="restartBtn" style="margin-top:12px; background: linear-gradient(120deg,#1a7a4f,var(--ok));">&#8635; Main Lagi</button>', '<button class="btn" id="restartBtn" style="margin-top:12px; background: linear-gradient(120deg,#1a7a4f,var(--ok));">&#8635; Play Again</button>'],
  // Example fill buttons
  ['<button class="btn btn-half" id="fillContributionBtn" style="background: var(--panel-soft); font-size:12px;">Isi Contoh Kontribusi</button>', '<button class="btn btn-half" id="fillContributionBtn" style="background: var(--panel-soft); font-size:12px;">Fill Example Contribution</button>'],
  ['<button class="btn btn-half" id="fillNarrativeBtn" style="background: var(--panel-soft); font-size:12px;">Isi Contoh Narasi</button>', '<button class="btn btn-half" id="fillNarrativeBtn" style="background: var(--panel-soft); font-size:12px;">Fill Example Narrative</button>'],
  // Right panel status
  ['<h3><span class="icon">&#128736;</span> Status Room</h3>', '<h3><span class="icon">&#128736;</span> Room Status</h3>'],
  ['<div id="matchInfo" style="font-size:12px; color:var(--muted);"></div>', '<div id="matchInfo" style="font-size:12px; color:var(--muted);"></div>'],
  ['<div id="playersInfo" style="font-size:12px; color:var(--muted); margin-top:6px;"></div>', '<div id="playersInfo" style="font-size:12px; color:var(--muted); margin-top:6px;"></div>'],
  ['<h3><span class="icon">&#128196;</span> API Response</h3>', '<h3><span class="icon">&#128196;</span> API Response</h3>'],
  ['<pre id="apiOutput">Menunggu action...</pre>', '<pre id="apiOutput">Waiting for action...</pre>'],
  // Demo card
  ['<h3><span class="icon">&#9654;</span> Demo Otomatis</h3>', '<h3><span class="icon">&#9654;</span> Auto Demo</h3>'],
  ['<p style="font-size:12px; color:var(--muted); margin:0 0 10px;">Jalankan seluruh alur game otomatis dari awal sampai hasil.</p>', '<p style="font-size:12px; color:var(--muted); margin:0 0 10px;">Run the full game flow automatically from start to results.</p>'],
  // No results yet
  ['<td colspan="4" style="color:var(--muted)">Belum ada hasil</td>', '<td colspan="4" style="color:var(--muted)">No results yet</td>'],
];

let hcount = 0;
for (const [from, to] of htmlReplacements) {
  if (html.includes(from)) { html = html.split(from).join(to); hcount++; }
}
fs.writeFileSync('D:/Game/patchwork-truth/public/index.html', html);
console.log('HTML replacements: ' + hcount);

// Translate main.js
let js = fs.readFileSync('D:/Game/patchwork-truth/public/main.js', 'utf8');
const jsReplacements = [
  // PHASE_LABELS
  ['fragment_distribution: "Distribusi Fragmen"', 'fragment_distribution: "Fragment Distribution"'],
  ['negotiation: "Negosiasi"', 'negotiation: "Negotiation"'],
  ['ai_evaluation: "AI Evaluasi"', 'ai_evaluation: "AI Evaluation"'],
  ['results: "Hasil"', 'results: "Results"'],
  // resetState
  ['print("Menunggu action...")', 'print("Waiting for action...")'],
  // updateStatus
  ['`<div>Durasi: ${room.match.durationMinutes} menit</div>`', '`<div>Duration: ${room.match.durationMinutes} min</div>`'],
  // renderFragments
  ['Tidak ada fragmen. Mulai dengan contoh di bawah.', 'No fragments available. Start with the examples below.'],
  // Leaderboard breakdown
  ['<span class="label">Kontribusi diterima</span>', '<span class="label">Contributions accepted</span>'],
  ['<span class="label">Challenge benar</span>', '<span class="label">Challenges correct</span>'],
  ['<span class="label">Challenge gagal</span>', '<span class="label">Challenges failed</span>'],
  // print messages
  ['print("Masukkan nama kamu dulu di kolom nama.")', 'print("Enter your name first in the name field.")'],
  ['print("Gagal buat room: "', 'print("Failed to create room: "'],
  // demo run messages
  ['"Starting full demo..."', '"Starting full demo..."'],
  ['"Demo error: "', '"Demo error: "'],
  ['"Auto challenge: bukti signal spike terlalu kuat untuk diabaikan."', '"Auto challenge: signal spike evidence too strong to ignore."'],
  ['"Full demo completed!"', '"Full demo completed!"'],
];

let jcount = 0;
for (const [from, to] of jsReplacements) {
  if (js.includes(from)) { js = js.split(from).join(to); jcount++; }
}
fs.writeFileSync('D:/Game/patchwork-truth/public/main.js', js);
console.log('JS replacements: ' + jcount);
