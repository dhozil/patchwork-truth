// ============================================================
// Patchwork Truth — Showcase Mode UI (main.js)
// ============================================================

const API_BASE = "";  // Use relative URLs (works both locally and on Vercel)

// ── Global click sound ───────────────────────────────────────
document.addEventListener("click", (e) => {
  // Don't block clicks on selectable text elements (room code, etc.)
  const el = e.target.closest(".menu-card, button, a, [role=button]");
  if (!el) return;
  SFX.ensureReady().then(() => SFX.playClick());
}, { passive: true });

// State
let roomCode = "";
let hostId = "";
let playerId = "";
let playerAddress = "";  // Wallet address
let playerName = "";       // Display name from wallet/contract
let currentPhase = "lobby";
let isSolo = false;
let speedMode = false;
let timerInterval = null;
let currentPlayers = [];  // latest player list from server (used for actual fragments)
let selectedScenario = "mystery";
let scenarios = [];
let selectedDifficulty = "easy";

// ── Scenario accent colors ────────────────────────────────────────────────────
// Sets --accent and --accent-glow CSS vars on :root so buttons, borders, and
// other UI elements match the current scenario's theme color.
const SCENARIO_COLORS = {
  mystery:     { color: "#ff0080", glow: "rgba(255,0,128,0.25)" },
  scifi:       { color: "#00e5ff", glow: "rgba(0,229,255,0.25)" },
  politics:    { color: "#ffe600", glow: "rgba(255,230,0,0.25)" },
  conspiracy: { color: "#a855f7", glow: "rgba(168,85,247,0.25)" },
  heist:       { color: "#ff6b35", glow: "rgba(255,107,53,0.25)" },
  corporate:   { color: "#6366f1", glow: "rgba(99,102,241,0.25)" },
  historical:  { color: "#d4a574", glow: "rgba(212,165,116,0.25)" },
  survival:    { color: "#22c55e", glow: "rgba(34,197,94,0.25)" },
};

function setScenarioAccent(scenarioId) {
  const palette = SCENARIO_COLORS[scenarioId] || SCENARIO_COLORS.mystery;
  document.documentElement.style.setProperty("--accent", palette.color);
  document.documentElement.style.setProperty("--accent-glow", palette.glow);
}

// DOM helpers
const $ = (id) => document.getElementById(id);
const val = (id) => $(id)?.value?.trim() || "";

// ── Screens ──────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = $(id);
  if (el) el.classList.add("active");
}

function showIntro() { resetState(); showScreen("introScreen"); }
function showGame()  { showScreen("gameScreen"); }
function showMenu()  { userIsInteracting = false; showScreen("menuScreen"); }
function showGuide() { showScreen("guideScreen"); }
function showLeaderboard() { showScreen("leaderboardScreen"); loadGlobalLeaderboard(); }
function showAdvancedSetup() { resetState(); showScreen("advancedSetupScreen"); renderAdvScenarioSelector(); }

// ── Reset ────────────────────────────────────────────────────
function resetState() {
  roomCode = ""; hostId = ""; playerId = "";
  currentPhase = "lobby"; isSolo = false; speedMode = false;
  gameFinalized = false;
  userIsInteracting = false;
  // Sync wallet button state in case playerAddress was cleared
  if (typeof updateWalletUI === "function") updateWalletUI(Wallet.getState());
  stopTimerPoll();
  stopWaitingPoll();
  stopLobbyPoll();
  hideAllPanels();
  // Safety: ensure all game buttons are re-enabled and not stuck in disabled state
  // from previous session (e.g. finalizeBtn stuck in submitting=1 state)
  document.querySelectorAll("button").forEach(b => {
    b.disabled = false;
    if (b.dataset) b.dataset.submitting = "0";
    const defaultText = b.dataset?.defaultText;
    if (defaultText) b.textContent = defaultText;
  });
  // Save player name for next session
  if (playerName) localStorage.setItem("pt_playerName", playerName);
  // Close celebration overlay
  const overlay = $("celebrationOverlay");
  if (overlay) overlay.classList.add("hidden");
  // Close confetti canvas
  const canvas = $("confetti-canvas");
  if (canvas) { const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  renderPhaseTimeline("lobby");
  const phaseTag = $("phaseTag");
  const modeTag = $("modeTag");
  const roomBadge = $("roomBadge");
  const statusText = $("statusText");
  if (phaseTag) phaseTag.textContent = "phase: --";
  if (modeTag) { modeTag.textContent = ""; modeTag.className = "chip chip-info"; }
  if (roomBadge) roomBadge.textContent = "";
  if (statusText) statusText.innerHTML = "";
  const fragPanel = $("fragPanel");
  const demoRunPanel = $("demoRunPanel");
  if (fragPanel) fragPanel.style.display = "none";
  if (demoRunPanel) demoRunPanel.style.display = "none";
  // Show lobby panel when resetting
  const lp = $("lobbyPanel");
  if (lp) lp.style.display = "block";
  const timerDisplay = $("timerDisplay");
  const submitProgress = $("submitProgress");
  if (timerDisplay) timerDisplay.style.display = "none";
  if (submitProgress) submitProgress.style.display = "none";
}

// ── Panel visibility ──────────────────────────────────────────
function hideAllPanels() {
  ["lobbyPanel","fragPanel","contribPanel","finalizePanel",
   "challengePanel","resultsPanel","leaderboardPanel",
   "demoRunPanel"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = "none";
  });
}
function showPanel(id) {
  hideAllPanels();
  const el = $(id);
  if (el) el.style.display = "block";
}

// Show negotiate+draft phase panels together
function showNegotiationPanel() {
  const fg = $("fragPanel");
  const cp = $("contribPanel");
  const fp = $("finalizePanel");
  // Hide all left-panel children that might be showing
  ["fragPanel","contribPanel","finalizePanel","challengePanel","resultsPanel","leaderboardPanel","demoRunPanel"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = "none";
  });
  // Only show contribution + finalize
  if (fg) fg.style.display = "none";
  if (cp) cp.style.display = "block";
  if (fp) fp.style.display = "block";
}

// ── Phase timeline ──────────────────────────────────────────────
const PHASE_ORDER = [
  { key: "lobby",               label: "Lobby",            icon: "🚪" },
  { key: "fragment_distribution", label: "Fragments",       icon: "📄" },
  { key: "negotiation",          label: "Negotiation",         icon: "💬" },
  { key: "drafting",             label: "Drafting",          icon: "✍️" },
  { key: "ai_evaluation",        label: "AI Evaluation",      icon: "🤖" },
  { key: "challenge_window",     label: "Challenge",        icon: "⚡" },
  { key: "results",             label: "Results",             icon: "🏆" }
];
function renderPhaseTimeline(phase) {
  const track = $("phaseTrack");
  if (!track) return;
  const idx = PHASE_ORDER.findIndex(p => p.key === phase);
  track.innerHTML = PHASE_ORDER.map((p, i) => {
    const done = i < idx;
    const active = phase === p.key;
    const cls = active ? "active" : done ? "done" : "";
    return `<div class="phase-pill ${cls}">
      <span class="pn">${done ? "✓" : i + 1}</span>
      <span>${p.icon} ${p.label}</span>
    </div>`;
  }).join("");
}

// ── Status bar ────────────────────────────────────────────────
function updateStatus(room) {
  currentPhase = room?.phase || currentPhase;
  const phaseTag = $("phaseTag");
  const modeTag = $("modeTag");
  const roomBadge = $("roomBadge");
  const speedTag = $("speedTag");
  if (phaseTag) phaseTag.textContent = `phase: ${room?.phase || "--"}`;
  if (modeTag) {
    // Sync isSolo from server so status bar reflects actual player count
    if (room && room.playerCount !== undefined) isSolo = room.playerCount === 1;
    modeTag.textContent = isSolo ? "solo" : `${(room?.playerCount || 0)} players`;
    modeTag.className = "chip " + (isSolo ? "chip-mag" : "chip-cyan");
  }
  if (speedTag) speedTag.textContent = speedMode ? "⚡ Speed" : "Normal";
  if (speedTag) speedTag.className = "chip " + (speedMode ? "chip-cyan" : "chip-green");
  if (roomBadge) roomBadge.textContent = room?.roomCode ? `Room: ${room.roomCode}` : "";
  const rcDisplay = $("roomCodeDisplay");
  if (rcDisplay) rcDisplay.textContent = room?.roomCode || "---";
  renderPhaseTimeline(room?.phase);
  updateHostControls();
  // Sync scenario chip from server data (keeps non-host in sync with host's scenario choice)
  if (room?.scenario) {
    const scenarioChip = $("scenarioChip");
    if (scenarioChip) {
      scenarioChip.textContent = `${room.scenario.emoji || "📋"} ${room.scenario.label}`;
      scenarioChip.style.display = "inline-flex";
    }
  }
  // Update player list in right panel — always sync when in game (room.players may be undefined on first poll)
  if (room?.players) {
    renderPlayerList(room.players);
  } else if (currentPlayers.length > 0) {
    renderPlayerList(currentPlayers);
  }
}

// Render player list in right panel
function renderPlayerList(players) {
  const container = $("playerListInRoom");
  if (!container) return;
  // Fallback to currentPlayers if room doesn't pass players directly
  const list = (players && players.length > 0) ? players : (window.currentPlayers || []);
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="font-size:14px;color:var(--muted);">Waiting...</div>';
    return;
  }
  const myId = playerId || hostId;
  container.innerHTML = list.map(p => {
    const isMe = p.id === myId;
    const isHost = p.id === hostId;
    return `<div class="player-item${isMe ? ' is-me' : ''}">
      <div class="player-dot"></div>
      <div class="player-name">${p.name || "Player"}</div>
      ${isHost ? '<span class="player-badge host-badge">host</span>' : ''}
      ${isMe ? '<span class="player-badge">you</span>' : ''}
    </div>`;
  }).join('');
}

// ── Fragments ─────────────────────────────────────────────────
// Reset scoreNum + results panel to clean state — called at every entry point to prevent stale 88
// IMPORTANT: skip reset if game is already finalized (results panel has rankings that must not be clobbered)
function resetScoreDisplay() {
  // If wallet TX was cancelled, hide result panel immediately so 88 never shows
  if (confirmCancel) {
    const rp = $("resultsPanel");
    if (rp) { rp.style.display = "none"; rp.innerHTML = ""; }
    confirmCancel = false;
  }
  const sn = $("scoreNum");
  if (sn) { sn.textContent = "--"; sn.setAttribute("data-val", ""); sn.classList.remove("score-flash"); }
  const rg = $("rubricGrid");
  if (rg) rg.innerHTML = "";
  const ab = $("aiConsensusBadge");
  if (ab) ab.style.display = "none";
  const nxt = $("nextPhaseBtn");
  if (nxt) nxt.style.display = "none";
  const wm = $("waitingHostMsg");
  if (wm) wm.style.display = "none";
  // If game was finalized with real scores, keep rankings visible
  if (gameFinalized) return; // rankings already showing — do NOT touch scoreNum or rubricGrid
}

function renderFragments(players, myId) {
  const grid = $("fragGrid");
  if (!grid) return;
  const me = (players || []).find(p => p.id === myId || p.id === hostId);
  if (!me) return;
  const frags = me.fragments || [];
  if (!frags.length) {
    grid.innerHTML = `<div class="frag-chip" style="grid-column:1/-1;">
      <div class="frag-chip-label">Info</div>No fragments available. Use the examples below.
    </div>`;
    return;
  }
  grid.innerHTML = frags.map((f, i) => {
    const label = f.type ? f.type.charAt(0).toUpperCase() + f.type.slice(1) : "Fragment";
    const content = f.content || f.text || JSON.stringify(f);
    return `<div class="frag-chip">
      <div class="frag-chip-label">${label} #${i + 1}</div>${content}
    </div>`;
  }).join("");
}

// ── Timer polling ───────────────────────────────────────────
let pollInterval = null;
let userIsInteracting = false; // block poll from overwriting during form input
let gameFinalized = false; // prevent poll from overwriting phase after finalize
let confirmCancel = false; // set true when wallet TX was cancelled — resetScoreDisplay hides result panel

function startTimerPoll() {
  stopTimerPoll();
  pollInterval = setInterval(async () => {
    if (!roomCode) return;
    // Block poll during form submissions only. After finalize, poll MUST continue
    // so it can detect when server transitions phase → "results" and show the results panel.
    const isNonHost = hostId != null && playerId && hostId !== playerId;
    if (!isNonHost && userIsInteracting) return;
    try {
      const data = await api("GET", "/rooms/" + roomCode);
      // Sync scenario for non-host — server has authoritative scenario
      if (data.scenario) {
        selectedScenario = data.scenario.id || selectedScenario;
        setScenarioAccent(selectedScenario);
        const scenarioChip = $("scenarioChip");
        if (scenarioChip && !scenarioChip.style.display) {
          scenarioChip.textContent = `${data.scenario.emoji || "📋"} ${data.scenario.label}`;
          scenarioChip.style.display = "inline-flex";
        }
      }
      // Update status first (syncs player list to right panel before panel changes)
      updateStatus(data);
      // Sync panel UI to server phase (handles non-host players getting frag/contrib panels)
      // BLOCK advancePhaseUI after finalize — rankings/results panel owns the UI.
      // Block even for non-results phases (e.g. "drafting") so waitingForOthers state is not
      // clobbered when timer poll fires and advancePhaseUI re-shows finalizeBtn.
      if (data.phase !== "lobby" && !gameFinalized) {
        advancePhaseUI(data.phase, data.players);
      } else if (gameFinalized) {
        // gameFinalized=true means either:
        // 1. We returned waitingForOthers (btn shows "⏳ Waiting...") — check if batch-finalize fired
        // 2. Results are already shown — keep results panel, don't touch anything
        // For case 1: if phase is still drafting/evaluation and server has playerResults with scores,
        // show the results panel immediately (server batch-finalized while we were waiting).
        // Guard: only fire when phase has actually changed to "results" or "ai_evaluation"
        // (prevents re-render every tick). Also detect when all players have aiConsensus=true.
        const allAiConsensus = data.playerResults && data.playerResults.length > 0 &&
          data.playerResults.every(r => r.aiConsensus === true);
        if (data.phase === "results" || data.phase === "ai_evaluation" || allAiConsensus || (data.playerResults && data.playerResults.length > 0 && data.playerResults.every(r => r.score > 0))) {
          if (currentPhase !== "results") {
            stopTimerPoll();
            currentPhase = "results";
            renderPhaseTimeline("results");
            ["contribPanel","finalizePanel","fragPanel","demoRunPanel","challengePanel"].forEach(id => {
              const el = $(id); if (el) el.style.display = "none";
            });
            const rp = $("resultsPanel");
            if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
            const myPlayerId = playerId || hostId;
            const myResult = data.playerResults.find(r => r.id === myPlayerId);
            const evalForRender = myResult ? {
              totalScore: myResult.score || 0,
              aiConsensus: myResult.aiConsensus || false,
              aiScores: myResult.aiScores || myResult.rubricScores || null,
              rubricScores: myResult.rubricScores || myResult.aiScores || null
            } : null;
            if (rp) rp._evaluation = evalForRender;
            if (evalForRender) renderResults(evalForRender);
            renderRankings(data.playerResults, myPlayerId, evalForRender);
            startPostFinalizePoll();
            showToast("Results computed!", "ok");
          }
        }
      }
      // Store latest player list for fillContrib/fillNarr to use actual fragments
      if (data.players) currentPlayers = data.players;
      // ── Results / Rankings ────────────────────────────────────────
      // Server sets phase=results with playerResults when batch-finalize completes.
      // Only process on the FIRST detection of results (gameFinalized=false).
      // After that, the allFinalized handler owns the UI — poll must NOT overwrite it.
      if (data.phase === "results" && data.playerResults && data.playerResults.length > 0) {
        const myPlayerId = playerId || hostId;

        if (!gameFinalized) {
          stopTimerPoll();
          gameFinalized = true;
          currentPhase = "results";
          renderPhaseTimeline("results");

          // Always hide all contribution/finalize panels
          ["contribPanel","finalizePanel","fragPanel","demoRunPanel","challengePanel"].forEach(id => {
            const el = $(id); if (el) el.style.display = "none";
          });

          // Show results panel
          const rp = $("resultsPanel");
          if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }

          // Set _evaluation BEFORE renderRankings
          const myResult = data.playerResults.find(r => r.id === myPlayerId);
          if (rp) {
            rp._evaluation = myResult
              ? {
                  totalScore: myResult.score,
                  aiConsensus: myResult.aiConsensus || false,
                  aiScores: myResult.aiScores || myResult.rubricScores || null,
                  rubricScores: myResult.rubricScores || myResult.aiScores || null
                }
              : null;
          }

          // Render rankings AND score — both at the same time, before any poll overwrite.
          // Pass rp._evaluation so renderRankings can call renderResults with correct scores.
          renderRankings(data.playerResults, myPlayerId, rp._evaluation);
        }
      }
      // Update ready banner for multiplayer
      updateReadyBanner(data);
      const timerData = await api("GET", `/rooms/${roomCode}/timer`);
      updateTimerDisplay(timerData);
      if (timerData.allSubmitted) {
        try {
          const result = await api("POST", "/rooms/" + roomCode + "/check-auto-advance");
          if (result.autoAdvance) {
            const roomData = await api("GET", "/rooms/" + roomCode);
            advanceUI({ phase: result.toPhase, players: roomData.players });
          }
        } catch (_) {}
      }
    } catch (err) {
      // Room gone (server restart) — stop polling, show error
      if (err.message.includes("404") || err.message.includes("Room not found")) {
        console.warn("[Poll] Room not found, stopping poll...");
        stopTimerPoll();
        showToast("Connection lost — room no longer exists", "warn");
        return;
      }
      // Other errors — let poll continue (transient)
    }
  }, 2000);
}
function stopTimerPoll() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  stopPostFinalizePoll();  // also stop the post-finalize re-rank poll
}

// ── Lobby polling for multiplayer ───────────────────────────────
let lobbyPollInterval = null;
let lobbyPollMissed = 0; // track consecutive errors (transient vs real 404)

function startLobbyPoll() {
  stopLobbyPoll();
  lobbyPollMissed = 0;
  // Small delay before first poll to avoid race condition with room creation
  let pollCount = 0;
  lobbyPollInterval = setInterval(async () => {
    if (!roomCode) { stopLobbyPoll(); return; }
    // Only poll in lobby phase — game started means stop polling
    try {
      const data = await api("GET", "/rooms/" + roomCode);
      lobbyPollMissed = 0; // reset on success
      updateLobbyDisplay(data);
      if (data.phase !== "lobby") {
        // Game started — stop lobby poll, start timer poll instead
        stopLobbyPoll();
        // Sync scenario for non-host before starting game poll
        if (data.scenario) {
          selectedScenario = data.scenario.id || "mystery";
          setScenarioAccent(selectedScenario);
          const scenarioChip = $("scenarioChip");
          if (scenarioChip) {
            scenarioChip.textContent = `${data.scenario.emoji || "📋"} ${data.scenario.label}`;
            scenarioChip.style.display = "inline-flex";
          }
        }
        startTimerPoll();
        advancePhaseUI(data.phase, data.players);
      }
    } catch (err) {
      // Count consecutive errors — 2 consecutive 404s means room truly gone
      if (err.message.includes("404") || err.message.includes("Room not found")) {
        console.warn("[Lobby] Room GET 404, retrying immediately...");
        // Immediate retry on first 404 (could be server still creating room)
        try {
          const dataRetry = await api("GET", "/rooms/" + roomCode);
          lobbyPollMissed = 0;
          updateLobbyDisplay(dataRetry);
          if (dataRetry.phase !== "lobby") {
            stopLobbyPoll();
            if (dataRetry.scenario) {
              selectedScenario = dataRetry.scenario.id || "mystery";
              const scenarioChip = $("scenarioChip");
              if (scenarioChip) {
                scenarioChip.textContent = `${dataRetry.scenario.emoji || "📋"} ${dataRetry.scenario.label}`;
                scenarioChip.style.display = "inline-flex";
              }
            }
            startTimerPoll();
            advancePhaseUI(dataRetry.phase, dataRetry.players);
          }
          return;
        } catch (retryErr) {
          // Still failing — count it
          lobbyPollMissed++;
        }
        if (lobbyPollMissed >= 2) {
          console.warn("[Lobby] Room not found (2x), returning to menu...");
          stopLobbyPoll();
          showToast("Room no longer exists", "warn");
          showMenu();
          resetState();
          return;
        }
      } else {
        // Non-404 error (network, server error) — also retry, don't panic
        console.warn("[Lobby] Poll error:", err.message);
      }
    }
  }, 1500);
}
function stopLobbyPoll() {
  if (lobbyPollInterval) { clearInterval(lobbyPollInterval); lobbyPollInterval = null; }
  lobbyPollMissed = 0;
}
function updateLobbyDisplay(room) {
  if (!room) return;
  const pc = $("playerCountDisplay");
  if (pc) {
    const count = room.playerCount || 0;
    pc.textContent = count === 1 ? "1 player joined" : `${count} players joined`;
  }
  const plLobby = $("playerListDisplayLobby");
  if (plLobby && room.players) {
    plLobby.innerHTML = room.players.map((p, i) => {
      const color = getAvatarColor(i);
      const emoji = getPlayerAvatar(i);
      return `<span class="${color.cls}" style="margin-right:6px;vertical-align:middle;">${emoji}</span> ${p.name}`;
    }).join("<br>");
  }
  const rcDisplay = $("roomCodeDisplay");
  if (rcDisplay && room.roomCode) rcDisplay.textContent = room.roomCode;
  updateStatus(room);
}
function updateTimerDisplay(timerData) {
  const timerDisplay = $("timerDisplay");
  const submitProgress = $("submitProgress");
  const submitProgressText = $("submitProgressText");
  const progressBarFill = $("progressBarFill");

  const rem = timerData.remainingSeconds;
  const mins = rem !== null ? Math.floor(rem / 60) : null;
  const secs = rem !== null ? rem % 60 : null;
  const timeStr = mins !== null ? `${mins}:${String(secs).padStart(2, "0")}` : "--:--";

  if (timerDisplay) {
    timerDisplay.textContent = timeStr;
    timerDisplay.className = "timer-display";
    if (rem !== null && rem < 15) timerDisplay.classList.add("danger");
    else if (rem !== null && rem < 30) timerDisplay.classList.add("warn");
  }

  const submitted = timerData.submittedCount || 0;
  const total = timerData.totalPlayers || 1;
  if (submitProgress) submitProgress.style.display = "flex";
  if (progressBarFill) progressBarFill.style.width = `${(submitted / Math.max(total, 1)) * 100}%`;
}

// ── Results ─────────────────────────────────────────────────
function renderResults(evaluation) {
  if (!evaluation) return;
  console.log(`[renderResults] totalScore=${evaluation.totalScore} aiConsensus=${evaluation.aiConsensus}`, JSON.stringify({ aiScores: evaluation.aiScores, rubricScores: evaluation.rubricScores }));
  // Contract returns snake_case keys (evidence, argument, manipulation).
  // Also support camelCase (evidenceIntegration, argumentQuality, manipulationResistance).
  // Prefer aiScores when available (GenLayer consensus). Fall back to rubricScores
  // (rubric fallback or from batch-finalize). This ensures the per-dimension
  // breakdown always shows — even when aiScores is null on the host.
  const raw = evaluation.aiScores && Object.keys(evaluation.aiScores).length > 0
    ? evaluation.aiScores
    : evaluation.rubricScores;
  const scores = raw
    ? {
        coherence: raw.coherence || 0,
        // Contract: evidence → Client display: evidenceIntegration
        evidenceIntegration: raw.evidenceIntegration || raw.evidence || 0,
        // Contract: argument → Client display: argumentQuality
        argumentQuality: raw.argumentQuality || raw.argument || 0,
        // Contract: manipulation → Client display: manipulationResistance
        manipulationResistance: raw.manipulationResistance || raw.manipulation || 0
      }
    : {};
  const scoreNum = $("scoreNum");
  if (scoreNum) {
    const sc = evaluation.totalScore || 0;
    scoreNum.textContent = sc;
    scoreNum.setAttribute("data-val", sc > 0 ? sc : "");
  }
  const rubricGrid = $("rubricGrid");
  if (rubricGrid) {
    rubricGrid.innerHTML = Object.entries(scores).map(([k, v]) =>
      `<div class="rubric-cell">
        <span class="rn">${k.replace(/([A-Z])/g, " $1").trim()}</span>
        <span class="rs">${v}/25</span>
      </div>`
    ).join("");
  }
  // Show AI Consensus badge when score came from GenLayer contract
  const aiBadge = $("aiConsensusBadge");
  if (aiBadge) {
    aiBadge.style.display = (evaluation.aiConsensus || (evaluation.aiScores && Object.keys(evaluation.aiScores).length > 0)) ? "block" : "none";
  }
}

// ── Leaderboard ────────────────────────────────────────────────
function renderLeaderboard(data, tbodyId) {
  const tbodyIds = tbodyId ? [tbodyId] : ["lbBody", "lbBody2"];
  const rows = data?.leaderboard || [];
  const meId = playerId || hostId;
  const chips = [];
  if (isSolo) chips.push(`<span class="chip chip-warn">Solo Mode</span>`);
  if (data?.finalNarrativeScore) chips.push(`<span class="chip chip-ok">Narrative: ${data.finalNarrativeScore}/100</span>`);
  const phaseTag = $("phaseTag");
  if (phaseTag) {
    phaseTag.textContent = "results";
  }

  tbodyIds.forEach(tid => {
    $(tid).innerHTML = !rows.length
      ? `<tr><td colspan="4" style="color:var(--muted)">No results yet</td></tr>`
      : rows.map(row => {
        const rbg = row.rank === 1 ? "rb1" : row.rank === 2 ? "rb2" : row.rank === 3 ? "rb3" : "rbn";
        return `<tr>
          <td><span class="rbadge ${rbg}">${row.rank}</span></td>
          <td>${row.name}${row.playerId === meId ? " (kamu)" : ""}</td>
          <td><strong>${row.score}</strong></td>
          <td style="color:var(--green)">${row.xp} XP</td>
        </tr>`;
      }).join("");
  });

  const me = rows.find(r => r.playerId === meId) || rows[0];
  const bdList = $("bdList");
  if (me?.breakdown && bdList) {
    const bd = me.breakdown;
    bdList.innerHTML = `
      <div class="bd-row"><span class="bl">Contributions accepted</span><span class="bv pos">+${bd.acceptedContributions * 10} pts</span></div>
      <div class="bd-row"><span class="bl">Challenges correct</span><span class="bv pos">+${bd.accurateChallenges * 15} pts</span></div>
      <div class="bd-row"><span class="bl">Challenges failed</span><span class="bv neg">-${bd.failedChallenges * 5} pts</span></div>
      <div class="bd-row" style="background:rgba(110,168,254,0.1)"><span class="bl" style="color:#cde0ff;font-weight:700">Total</span><span class="bv" style="color:#cde0ff;font-size:13px">${me.score} pts</span></div>
    `;
  }
}

// ── Toast notifications ──────────────────────────────────────
let toastTimeout = null;
function showToast(message, type = "") {
  SFX.playToast(type);
  const existing = document.getElementById("toast");
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);
  const el = document.createElement("div");
  el.id = "toast";
  el.className = "toast" + (type ? " " + type : "");
  el.textContent = message;
  document.body.appendChild(el);
  toastTimeout = setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 300); }, 2800);
}

// ── Ready system ─────────────────────────────────────────────────
let readyBannerActive = false;

function updateReadyBanner(roomData) {
  // Show READY banner only when: multiplayer non-host + countdown active + correct phase
  const isMultiplayer = roomData.playerCount > 1 && !roomData.speedMode;
  // Non-host = we ARE in a room AND our playerId is NOT the room's hostId
  const isNonHost = roomData.hostId && playerId && roomData.hostId !== playerId;
  // Only show during the phase where countdown was started — not stale from previous phase
  const showReadyPhase = ["fragment_distribution", "negotiation", "final_drafting"].includes(roomData.phase);
  const waitingForReady = roomData.waitingForReady || false;
  const shouldShow = isMultiplayer && isNonHost && showReadyPhase && waitingForReady;

  const why = [
    !isMultiplayer ? "NOT multiplayer" : "",
    !isNonHost ? "is host or missing hostId/playerId" : "",
    !showReadyPhase ? `phase=${roomData.phase} not in READY phases` : "",
    !waitingForReady ? "waitingForReady=false" : ""
  ].filter(Boolean).join(" | ");

  const fragPanel = document.getElementById("fragPanel");
  const contribPanel = document.getElementById("contribPanel");
  // There are two banners: one inside fragPanel, one inside contribPanel
  // Both share classes so we can update both via querySelectorAll
  const banners = document.querySelectorAll(".ready-banner");
  const bannerTexts = document.querySelectorAll(".ready-banner-text");
  const readyBtns = document.querySelectorAll(".ready-btn");

  if (banners.length === 0) return;

  // Hide ALL banners first
  banners.forEach(b => b.style.display = "none");
  readyBtns.forEach(b => { b.disabled = true; b.style.opacity = "0.5"; b.style.cursor = "default"; });

  if (!shouldShow) return;

  const readiedCount = roomData.readiedCount || 0;
  const totalPlayers = roomData.playerCount || 1;
  const remainingSec = roomData.readyTimeout ? roomData.readyTimeout.remainingSeconds : null;
  const me = roomData.players?.find(p => p.id === playerId);
  const iAmReady = me?.ready;

  // Build banner text
  let text = "";
  if (iAmReady) {
    text = `You are ready! Waiting for others... (${readiedCount}/${totalPlayers})`;
  } else if (remainingSec !== null && remainingSec > 0) {
    const names = roomData.players?.filter(p => p.ready).map(p => p.name).join(", ") || "";
    const nameNote = names ? ` — ${names} ready` : "";
    text = `⏰ Ready up in ${remainingSec}s! (${readiedCount}/${totalPlayers})${nameNote}`;
  } else {
    text = `Waiting for all players... (${readiedCount}/${totalPlayers})`;
  }

  // Show ALL banners and enable buttons for non-ready non-host players
  banners.forEach(b => {
    b.style.display = "block";
  });
  bannerTexts.forEach(t => t.textContent = text);

  if (!iAmReady) {
    readyBtns.forEach(b => {
      b.disabled = false;
      b.style.opacity = "1";
      b.style.cursor = "pointer";
      b.textContent = "✓ READY";
    });
  }
}

// Player clicks the Ready button (delegated from gameScreen since button moves between panels)
document.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("ready-btn")) return;
  if (!roomCode || !playerId) return;
  // Guard: only non-host players can use the READY button
  if (hostId && playerId && hostId === playerId) return;
  const btn = e.target;
  btn.textContent = "..."; btn.disabled = true;
  try {
    const result = await api("POST", "/rooms/" + roomCode + "/player-ready", { playerId });
    showToast(result.allReady ? "All players ready! Waiting for host..." : "You are ready! Waiting for others...", "ok");
    const roomData = await api("GET", "/rooms/" + roomCode);
    updateReadyBanner(roomData);
  } catch (e) {
    showToast("Ready failed: " + e.message, "warn");
    btn.textContent = "✓ READY"; btn.disabled = false;
  }
});

// Copy room code to clipboard
function copyRoomCode() {
  const code = $("roomCodeDisplay")?.textContent || roomCode || "";
  if (!code || code === "---") return;
  navigator.clipboard.writeText(code).then(() => {
    showToast("Room code copied!", "ok");
    const btn = $("copyRoomCodeBtn");
    if (btn) { btn.textContent = "✓ Copied!"; setTimeout(() => { btn.textContent = "⚙ Copy Room Code"; }, 1500); }
  }).catch(() => {
    // Fallback for browsers without clipboard API
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Room code copied!", "ok");
  });
}

// Pick random example from pool
let contribExampleIdx = 0;
let narrExampleIdx = 0;
// ── Fragments fill pool ──────────────────────────────────────────────
// fillContrib and fillNarr MUST NEVER produce overlapping content.
// Strategy: divide fragments array in half.
//   fillContrib → first half (indices 0 to n/2-1), rotates within it
//   fillNarr    → second half (indices n/2 to n-1), rotates within it
//   They are guaranteed non-overlapping because they use disjoint index ranges.
// Pool resets when phase changes (fragments.length differs from last known).
let _fragPool = [];      // [{frag, half}] ordered list
let _contribHead = 0;    // next pick index for fillContrib (in first half)
let _narrHead = 0;       // next pick index for fillNarr (in second half)

function _buildFragPool(frags) {
  _fragPool = [];
  const half = Math.ceil(frags.length / 2);
  for (let i = 0; i < frags.length; i++) {
    _fragPool.push({ idx: i, half: i < half ? "contrib" : "narr" });
  }
  _contribHead = 0;
  _narrHead = 0;
}

function _pickFragHalf(half) {
  const list = _fragPool.filter(p => p.half === half);
  if (list.length === 0) return null;
  const head = half === "contrib" ? _contribHead : _narrHead;
  const item = list[head % list.length];
  if (half === "contrib") {
    _contribHead = (_contribHead + 1) % list.length;
  } else {
    _narrHead = (_narrHead + 1) % list.length;
  }
  return item;
}

function _fillContrib() {
  const el = $("contribTxt");
  const sel = $("acceptedSel");
  const myPlayerId = playerId || hostId;
  const me = currentPlayers.find(p => p.id === myPlayerId);
  const frags = me?.fragments || [];

  if (frags.length === 0) {
    const pool = EXAMPLES[selectedScenario]?.contrib || EXAMPLES.mystery.contrib;
    const text = pool[contribExampleIdx % pool.length];
    contribExampleIdx++;
    if (el) { el.value = text; sel && (sel.value = "true"); }
    return;
  }

  // Rebuild pool when fragments change (new phase / room)
  if (_fragPool.length !== frags.length) {
    _buildFragPool(frags);
  }

  const item = _pickFragHalf("contrib");
  if (!item) return;
  const frag = frags[item.idx];
  const content = frag?.content || frag?.text || "";

  if (el) el.value = `"${content.substring(0, 100)}..." — evidence suggests a specific timeline of events.`;
  if (sel) sel.value = "true";
}

function _fillNarr() {
  const el = $("finalTxt");
  const myPlayerId = playerId || hostId;
  const me = currentPlayers.find(p => p.id === myPlayerId);
  const frags = me?.fragments || [];

  if (frags.length === 0) {
    const pool = EXAMPLES[selectedScenario]?.narrative || EXAMPLES.mystery.narrative;
    const text = pool[narrExampleIdx % pool.length];
    narrExampleIdx++;
    if (el) el.value = text;
    return;
  }

  // Rebuild pool when fragments change (new phase / room)
  if (_fragPool.length !== frags.length) {
    _buildFragPool(frags);
  }

  const item = _pickFragHalf("narr");
  if (!item) return;
  const frag = frags[item.idx];
  const content = frag?.content || frag?.text || "";

  if (el) el.value = `"${content.substring(0, 100)}..." — the strongest evidence suggests a specific timeline, but gaps remain and further investigation is needed.`;
}

// ── API ─────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch (_) {}
  if (!res.ok) throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
  return parsed;
}

// ── Game actions ──────────────────────────────────────────────
async function createRoom(name) {
  speedMode = $("speedModeToggle")?.checked ?? false;
  const data = await api("POST", "/rooms", { hostName: name, speedMode, scenarioId: selectedScenario });
  roomCode = data.roomCode;
  hostId = data.hostId;
  playerId = data.hostId;
  isSolo = true;
  setScenarioAccent(selectedScenario);
  // Update scenario display
  if (data.scenario) {
    const scenarioChip = $("scenarioChip");
    if (scenarioChip) {
      scenarioChip.textContent = `${data.scenario.emoji || "📋"} ${data.scenario.label}`;
      scenarioChip.style.display = "inline-flex";
    }
  }
  updateStatus({ ...data.room, roomCode });
  startLobbyPoll();
  return data;
}

async function joinRoom(name, code) {
  const cleanCode = (code || "").trim().toUpperCase();
  if (!cleanCode) { showToast("Enter the room code first!", "warn"); return; }
  speedMode = $("speedModeToggle")?.checked ?? false;
  try {
    const data = await api("POST", `/rooms/${cleanCode}/join`, { name });
    roomCode = cleanCode;
    playerId = data.playerId;
    hostId = null;  // joining player is not host
    isSolo = false;
    showToast("Joined room " + roomCode + " as " + name, "ok");
    showGame();
    const lobbyPanel = $("lobbyPanel");
    const hostBar = $("hostControlBar");
    const destroyBtn = $("destroyRoomBtn");
    const leaveBtn = $("leaveRoomBtn");
    if (lobbyPanel) { lobbyPanel.style.display = "block"; }
    if (hostBar) { hostBar.classList.add("hidden"); }
    // Non-host sees Leave Room
    if (destroyBtn) destroyBtn.style.display = "none";
    if (leaveBtn) leaveBtn.style.display = "block";
    ["fragPanel","contribPanel","finalizePanel","challengePanel","resultsPanel","leaderboardPanel","demoRunPanel"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    updateStatus({ ...data.room, roomCode });
    // Sync scenario + selectedScenario for non-host (used by fillContrib/fillNarr examples)
    if (data.room?.scenario) {
      selectedScenario = data.room.scenario.id || "mystery";
      const scenarioChip = $("scenarioChip");
      if (scenarioChip) {
        scenarioChip.textContent = `${data.room.scenario.emoji || "📋"} ${data.room.scenario.label}`;
        scenarioChip.style.display = "inline-flex";
      }
    }
    startLobbyPoll();
    return data;
  } catch (err) {
    showToast("Failed to join room", "warn");
    throw err;
  }
}

async function startMatch() {
  const data = await api("POST", "/rooms/" + roomCode + "/start", {
    hostId, durationMinutes: 10, allowSolo: true, speedMode
  });
  isSolo = data.mode === "solo";
  speedMode = data.speedMode || speedMode;
  updateStatus(data.room);
  startTimerPoll();
  // Get fresh room data with full players + fragments
  const roomData = await api("GET", "/rooms/" + roomCode);
  advancePhaseUI(roomData.phase, roomData.players);
  return data;
}

async function submitContrib() {
  const contribTxt = $("contribTxt");
  const text = contribTxt ? contribTxt.value : "The 19:07 signal spike should be the main timeline because it is supported by system logs, while the camera blackout should be treated as uncertainty.";
  const acceptedSel = $("acceptedSel");
  await api("POST", "/rooms/" + roomCode + "/contributions", {
    playerId, text, accepted: acceptedSel ? acceptedSel.value === "true" : true
  });
}

// ── Finalize ──────────────────────────────────────────────────────────────────────
// Competitive mode: each player submits their own narrative.
// 1. If wallet connected → browser calls GenLayer AI consensus via Wallet.evaluateNarrative()
// 2. Submit narrative to /finalize, passing AI scores if available
// 3. Server waits for ALL players, then computes rankings
async function submitFinalize(opts) {
  // CRITICAL: Reset scoreNum immediately so cancel/tx-revert can't show stale 88
  resetScoreDisplay();
  const finalTxt = $("finalTxt");
  const text = opts?.text ?? finalTxt?.value ?? "";

  if (!text || text.trim().length < 10) {
    showToast("Please write a narrative before finalizing", "warn");
    return { cancelled: true };
  }

  const myPlayerId = opts?.playerId ?? playerId ?? hostId;
  if (!myPlayerId) {
    showToast("Player ID not found", "warn");
    return { cancelled: true };
  }

  // Fetch room to get scenario + fragments for AI evaluation
  let fragments = [], scenarioId = "mystery";
  try {
    const roomData = await api("GET", "/rooms/" + roomCode);
    const me = roomData?.players?.find(p => p.id === myPlayerId);
    fragments = me?.fragments?.map(f => typeof f === "string" ? f : f.text || f.content || JSON.stringify(f)) || [];
    scenarioId = roomData?.scenario?.id || "mystery";
  } catch (e) {
    // Room fetch error — continue with empty fragments
  }

  // ── GenLayer AI Consensus (browser-direct via MetaMask) ─────────
  // Wrap in 90s timeout so slow/unconfirmed TX doesn't freeze the UI.
  // If timeout expires, skip AI scoring and fall through to server submission.
  let aiScores = null, aiTotal = 0, walletCancelled = false;
  const walletState = window.Wallet?.getState?.();
  if (walletState?.isConnected) {
    const matchId = "match_" + roomCode + "_" + Date.now();
    try {
      const timeoutMs = 90000;
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI evaluation timed out (90s)")), timeoutMs)
      );
      let aiResult = await Promise.race([
        Wallet.evaluateNarrative(matchId, scenarioId, text, fragments, []),
        timeoutPromise
      ]);
      if (typeof aiResult === "string") {
        try { aiResult = JSON.parse(aiResult); } catch (_) {}
      }
      const rawStr = typeof aiResult === "string" ? aiResult : "";
      if (!rawStr.includes("Undetermined")) {
        aiScores = {
          coherence: aiResult?.scores?.coherence || aiResult?.coherence || 0,
          evidenceIntegration: aiResult?.scores?.evidence || aiResult?.evidenceIntegration || aiResult?.evidence || 0,
          argumentQuality: aiResult?.scores?.argument || aiResult?.argumentQuality || aiResult?.argument || 0,
          manipulationResistance: aiResult?.scores?.manipulation || aiResult?.manipulationResistance || aiResult?.manipulation || 0
        };
        aiTotal = aiResult?.total_score || aiResult?.totalScore || 0;
        // CRITICAL: only keep scores if totalScore > 0. "Undetermined" responses
        // return 0 — we must NOT send fake scores or server applies rubric fallback 88
        if (aiTotal <= 0) { aiScores = null; aiTotal = 0; }
      }
    } catch (e) {
      const msg = e?.message || "";
      // Wallet cancelled/rejected by user OR evaluation timed out — skip AI, fall through to server
      // genlayer-js throws with code:4001 for MetaMask rejects; string messages also checked for coverage
      if (
        e?.code === 4001 ||
        msg.includes("timed out") ||
        msg.includes("rejected") ||
        msg.includes("cancelled") ||
        msg.includes("denied") ||
        msg.includes("User denied") ||
        msg.includes("signature") ||
        msg.includes("Signing interrupted")
      ) {
        walletCancelled = true;
      }
      // For any other error (network, contract revert, etc.), just continue without aiScores
    }
  }

  // ── Only block server submission if user explicitly cancelled (MetaMask rejected) ──
  // Timeout or contract error → still submit to server (rubric fallback applied server-side)
  if (walletCancelled) {
    userIsInteracting = false;
    showToast("Transaction cancelled — sign in MetaMask to finalize", "warn");
    confirmCancel = true;
    return { cancelled: true };
  }

  // ── Submit to server (only if wallet succeeded) ───────────────
  try {
    const result = await api("POST", "/rooms/" + roomCode + "/finalize", {
      playerId: myPlayerId,
      text: text.trim(),
      aiScores,
      totalScore: aiTotal
    });

    if (result.waitingForOthers) {
      const pending = result.pendingPlayers || (result.totalPlayers - result.finalizedCount);
      showToast(`Waiting for ${pending} player(s) to finalize...`, "ok");
      userIsInteracting = false;
      // CRITICAL: set gameFinalized so advancePhaseUI won't re-show finalizeBtn
      // on subsequent timer poll ticks. Without this, the button would reappear
      // because phase is still "drafting" and advancePhaseUI would show it.
      gameFinalized = true;
      // Stop timer poll (it will restart after results are shown)
      stopTimerPoll();
      // Auto-start the waiting poll so results appear as soon as batch-finalize fires
      startWaitingPoll(pending);
      // KEEP the finalizeBtn disabled — wait for batch-finalize before showing results.
      // All players see results together only after batch-finalize fires.
      const btn = $("finalizeBtn");
      if (btn) {
        btn.style.display = "block";
        btn.disabled = true;
        btn.textContent = "⏳ Waiting for other players...";
      }
      // Ensure finalizePanel stays visible (btn is the visual anchor, not the panel)
      const fp = $("finalizePanel");
      if (fp) fp.style.display = "block";
      return result;
    }

    // Server already computed results — rankings and score are returned directly
    if (result.alreadyFinalized) {
      stopTimerPoll();
      gameFinalized = true;
      currentPhase = "results";
      renderPhaseTimeline("results");
      ["fragPanel","contribPanel","finalizePanel","demoRunPanel","challengePanel"].forEach(id => {
        const el = $(id); if (el) el.style.display = "none";
      });
      const rp = $("resultsPanel");
      if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
      // Build evaluation from server's playerResults (with normalized scores)
      let evalForRender = null;
      if (result.playerResults) {
        const myPlayerId = playerId || hostId;
        const myResult = result.playerResults.find(r => r.id === myPlayerId);
        if (myResult) {
          evalForRender = {
            totalScore: myResult.score || 88,
            aiConsensus: myResult.aiConsensus || false,
            aiScores: myResult.aiScores || myResult.rubricScores || null,
            rubricScores: myResult.rubricScores || myResult.aiScores || null
          };
        }
      } else {
        // Fallback to old rubricScores field
        evalForRender = {
          totalScore: result.myScore || 88,
          aiConsensus: result.aiConsensus || false,
          aiScores: null,
          rubricScores: result.rubricScores || null
        };
      }
      if (rp) rp._evaluation = evalForRender;
      if (evalForRender) renderResults(evalForRender);
      // Server returns rankings directly — render them immediately
      if (result.rankings && result.rankings.length > 0) {
        const myPlayerId = playerId || hostId;
        renderRankings(result.rankings, myPlayerId, evalForRender);
      }
      showToast("Results computed!", "ok");
      startPostFinalizePoll();  // Poll for re-rank when host AI scores arrive
      userIsInteracting = false;
      return result;
    }

    if (result.allFinalized) {
      // Stop timer poll — hide old panels, show results
      stopTimerPoll();
      gameFinalized = true;
      currentPhase = "results";
      renderPhaseTimeline("results");
      ["fragPanel","contribPanel","finalizePanel","demoRunPanel","challengePanel"].forEach(id => {
        const el = $(id); if (el) el.style.display = "none";
      });
      // Build evaluation from result.playerResults BEFORE renderRankings so scores show correctly
      const rp = $("resultsPanel");
      let evalForRender = null;
      if (result.playerResults) {
        const myResult = result.playerResults.find(r => r.id === myPlayerId);
        if (myResult) {
          evalForRender = {
            totalScore: myResult.score || 0,
            aiConsensus: myResult.aiConsensus || false,
            aiScores: myResult.aiScores || myResult.rubricScores || null,
            rubricScores: myResult.rubricScores || myResult.aiScores || null
          };
        }
      } else {
        evalForRender = { totalScore: result.myScore || 0, aiConsensus: false, aiScores: null, rubricScores: null };
      }
      if (rp) rp._evaluation = evalForRender;
      renderRankings(result.rankings, myPlayerId, evalForRender);
      if (evalForRender) renderResults(evalForRender);
      try {
        const roomData = await api("GET", "/rooms/" + roomCode);
        if (roomData.evaluation) {
          if (rp) rp._evaluation = roomData.evaluation;
          renderResults(roomData.evaluation);
        }
        // Also update score display with each player's real ranking score
        if (roomData.playerResults && roomData.playerResults.length > 0) {
          const myResult = roomData.playerResults.find(r => r.id === myPlayerId);
          if (myResult && myResult.score !== undefined) {
            const evalForMe = {
              totalScore: myResult.score,
              aiConsensus: myResult.aiConsensus || false,
              aiScores: myResult.aiScores || myResult.rubricScores || null,
              rubricScores: myResult.rubricScores || myResult.aiScores || null
            };
            if (rp) rp._evaluation = evalForMe;
            renderResults(evalForMe);
          }
        }
      } catch (_) { /* non-critical — rankings already shown */ }
      showToast(`You ranked #${result.myRank} of ${result.totalPlayers}!`, "ok");
      startPostFinalizePoll();  // Poll for re-rank when host AI scores arrive
      userIsInteracting = false;
      return result;
    }

    return result;
  } catch (e) {
    showToast("Finalize error: " + e.message, "warn");
    userIsInteracting = false;
    throw e;
  }
}

// ── Waiting-for-others polling ─────────────────────────────────────────────────
// When host is stuck on waitingForOthers (their AI score is pending from GenLayer
// and other players are already done), this polls the server for batch-finalize.
// When /finalize returns allFinalized=true (after all AI scores arrived), this
// immediately renders results so host is NOT stuck while non-host already has results.
let waitingPollInterval = null;
let _waitingPollAttempts = 0;
const MAX_WAITING_POLL_ATTEMPTS = 60; // 5 min at 5s intervals

function startWaitingPoll(pendingCount) {
  if (waitingPollInterval) { console.log("[WaitPoll] already running, skipping start"); return; }
  _waitingPollAttempts = 0;
  console.log(`[WaitPoll] STARTING (pending=${pendingCount}, gameFinalized=${gameFinalized})`);
  waitingPollInterval = setInterval(async () => {
    if (!gameFinalized) { console.log("[WaitPoll] gameFinalized=false, stopping"); stopWaitingPoll(); return; }
    _waitingPollAttempts++;
    if (_waitingPollAttempts > MAX_WAITING_POLL_ATTEMPTS) {
      stopWaitingPoll();
      showToast("Score evaluation timed out — please refresh", "warn");
      return;
    }
    try {
      // Fetch latest room state — server's /finalize batch-finalize updates room state
      const roomData = await api("GET", "/rooms/" + roomCode);
      if (!roomData) { stopWaitingPoll(); return; }

      // Check if batch-finalize has fired.
      // roomData.playerResults exists AND every player has a totalScore (> 0 means real score).
      // Also detect if ALL players have aiConsensus=true (server set phase=evaluation with real scores).
      const allPlayersFinalized = roomData.playerResults && roomData.playerResults.length > 0 &&
        roomData.playerResults.every(r => r.score > 0);
      // Also detect if server already computed results by checking evaluation score
      const serverHasResult = roomData.evaluation && roomData.evaluation.totalScore > 0;
      // Detect batch-finalize by phase change OR by all players having scores OR all have aiConsensus.
      // Prefer playerEvaluations[myId] — gives each player their own score immediately
      // without waiting for /ai-result to update room.evaluation (host-only).
      const serverAdvanced = roomData.phase === "results" || roomData.phase === "ai_evaluation";
      const myPlayerId2 = playerId || hostId;
      const myEval = roomData.playerEvaluations?.[myPlayerId2];
      const myHasScore = myEval && myEval.totalScore > 0;
      // Robust: show results when this player has a score OR server advanced OR all scored
      const allScored = roomData.playerResults && roomData.playerResults.length > 0 &&
        roomData.playerResults.every(r => r.score > 0);
      // Robust: show results when ALL players have aiConsensus
      const allAiConsensus = roomData.playerResults && roomData.playerResults.length > 0 &&
        roomData.playerResults.every(r => r.aiConsensus === true);

      console.log(`[WaitPoll] tick=${_waitingPollAttempts} phase="${roomData.phase}" allScored=${allScored} allAiConsensus=${allAiConsensus} serverAdvanced=${serverAdvanced} serverHasResult=${serverHasResult}`, roomData.playerResults ? `playerResults=[${roomData.playerResults.map(r => r.name+":score="+r.score+":aiConsensus="+r.aiConsensus).join(", ")}]` : "no playerResults");

      if (allScored || serverAdvanced || allAiConsensus) {
        stopWaitingPoll();
        // Server has batch-finalize results — render them
        const btn = $("finalizeBtn");
        stopTimerPoll();
        gameFinalized = true;
        currentPhase = "results";
        renderPhaseTimeline("results");
        ["fragPanel","contribPanel","finalizePanel","demoRunPanel","challengePanel"].forEach(id => {
          const el = $(id); if (el) el.style.display = "none";
        });
        if (btn) { btn.style.display = "none"; }
        const rp = $("resultsPanel");
        if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
        const myPlayerId = playerId || hostId;
        const myResult = roomData.playerResults?.find(r => r.id === myPlayerId);
        let evalForRender = null;
        if (myResult) {
          evalForRender = {
            totalScore: myResult.score || 0,
            aiConsensus: myResult.aiConsensus || false,
            aiScores: myResult.aiScores || myResult.rubricScores || null,
            rubricScores: myResult.rubricScores || myResult.aiScores || null
          };
        }
        if (rp) rp._evaluation = evalForRender;
        if (evalForRender) renderResults(evalForRender);
        if (roomData.playerResults) renderRankings(roomData.playerResults, myPlayerId, evalForRender);
        startPostFinalizePoll();
        showToast("All scores computed! Results are in.", "ok");
      }
    } catch (_) { /* non-critical */ }
  }, 5000);
}

function stopWaitingPoll() {
  if (waitingPollInterval) { clearInterval(waitingPollInterval); waitingPollInterval = null; }
}

// After game is finalized (results shown), start polling to detect re-rankings
// when host's AI scores arrive and update player rankings on the server.
// Uses a separate longer interval so it doesn't interfere with normal UI updates.
let postFinalizePollInterval = null;
function startPostFinalizePoll() {
  if (postFinalizePollInterval) return;
  postFinalizePollInterval = setInterval(async () => {
    if (!gameFinalized) { stopPostFinalizePoll(); return; }
    try {
      const rd = await api("GET", "/rooms/" + roomCode);
      if (!rd) { stopPostFinalizePoll(); return; }
      // Update scoreNum with the latest per-player score from the server
      if (rd.playerResults && rd.playerResults.length > 0) {
        const myPlayerId = playerId || hostId;
        const myResult = rd.playerResults.find(r => r.id === myPlayerId);
        if (myResult) {
          const scoreNum = $("scoreNum");
          if (scoreNum) {
            const newScore = myResult.score || 0;
            const displayed = parseInt(scoreNum.textContent) || 0;
            if (newScore !== displayed && newScore > 0) {
              scoreNum.textContent = newScore;
              scoreNum.setAttribute("data-val", newScore);
            }
          }
          // Update rubric breakdown with latest per-player scores
          const evalForMe = {
            totalScore: myResult.score || 0,
            aiConsensus: myResult.aiConsensus || false,
            aiScores: myResult.aiScores || myResult.rubricScores || null,
            rubricScores: myResult.rubricScores || myResult.aiScores || null
          };
          renderResults(evalForMe);
          // Also re-render rankings if server has different data
          if (rd.playerResults) {
            const rp = $("resultsPanel");
            if (rp) rp._evaluation = evalForMe;
          }
        }
      }
    } catch (_) { /* non-critical */ }
  }, 8000);
}
function stopPostFinalizePoll() {
  if (postFinalizePollInterval) { clearInterval(postFinalizePollInterval); postFinalizePollInterval = null; }
  stopWaitingPoll(); // Clean up any waiting poll that may still be running
}

// Render per-player rankings in the results panel.
// evaluation: optional { totalScore, aiConsensus, aiScores, rubricScores } object.
// When provided, used for renderResults so score breakdown uses CORRECT scores.
function renderRankings(rankings, myPlayerId, evaluation) {
  const rp = $("resultsPanel");
  if (!rp) return;

  // Build rankings HTML
  const totalPlayers = rankings.length;
  const myRank = rankings.find(r => r.id === myPlayerId)?.rank || "?";
  const myScore = rankings.find(r => r.id === myPlayerId)?.score || 0;

  const rankingsHTML = rankings.map((r, idx) => {
    const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `#${r.rank}`;
    const rowClass = r.id === myPlayerId ? "rank-me" : "";
    return `<div class="rank-row ${rowClass}">
      <span class="rank-medal">${medal}</span>
      <span class="rank-name">${r.name}${r.id === myPlayerId ? " (you)" : ""}</span>
      <span class="rank-score">${r.score} pts</span>
    </div>`;
  }).join("");

  // Preserve score display elements; only inject rankings below them
  const existingScoreNum = $("scoreNum");
  const existingAiBadge = $("aiConsensusBadge");
  const existingRubricGrid = $("rubricGrid");
  const existingNextBtn = $("nextPhaseBtn");
  const existingScoreBox = rp.querySelector(".score-box");

  rp.innerHTML = `
    <div class="g-panel-title">&#127941; Final Results</div>
    ${existingScoreBox ? existingScoreBox.outerHTML : ""}
    ${existingRubricGrid ? `<div class="rubric-grid" id="rubricGrid">${existingRubricGrid.innerHTML}</div>` : ""}
    ${existingAiBadge ? existingAiBadge.outerHTML : ""}
    <div class="rankings-list">
      ${rankingsHTML}
    </div>
    <div class="results-actions" id="resultsActions">
      ${currentPhase === "results" ? `<button id="playAgainBtn" onclick="location.reload()">Play Again</button>` : ""}
    </div>
  `;
  rp.style.display = "block";

  // Immediately render scores from the provided evaluation object (not cached rp._evaluation).
  // This fixes score breakdown showing 0s when rp._evaluation has totalScore=0 from fallback paths.
  if (evaluation) renderResults(evaluation);

  // Inject nextPhaseBtn for host (host sees "Next Phase: Challenge Window" instead of instant results)
  // In solo mode playerId="" but hostId is set → check isHost via room playerCount or isSolo flag
  const amHost = hostId && (playerId === hostId || isSolo);
  if (amHost) {
    const actions = $("resultsActions");
    if (actions) {
      const nxtBtn = document.createElement("button");
      nxtBtn.id = "nextPhaseBtn";
      nxtBtn.className = "btn btn-scenario btn-full";
      nxtBtn.style.cssText = "width:100%;margin-top:8px;";
      nxtBtn.textContent = "Next Phase: Challenge Window";
      nxtBtn.addEventListener("click", async function() {
        const b = this; b.textContent = "⏳..."; b.disabled = true;
        try {
          const res = await fetch(API_BASE + "/rooms/" + roomCode + "/advance-phase", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ hostId })
          });
          if (res.ok) {
            const rd = await api("GET", "/rooms/" + roomCode);
            const newPhase = rd?.phase || "challenge_window";
            currentPhase = newPhase;
            renderPhaseTimeline(newPhase);
            advancePhaseUI(newPhase, rd.players);
            updateStatus(rd);
            showToast("Challenge window opened!", "ok");
          }
        } catch(e) { showToast("Error advancing phase", "warn"); }
        b.textContent = "Next Phase: Challenge Window"; b.disabled = false;
      });
      actions.insertBefore(nxtBtn, actions.firstChild);
    }
  } else {
    // Non-host: show waiting message until host advances
    const actions = $("resultsActions");
    if (actions) {
      const waitMsg = document.createElement("div");
      waitMsg.style.cssText = "text-align:center;color:var(--muted);font-size:14px;padding:12px;margin-top:8px;";
      waitMsg.textContent = "Waiting for host to advance...";
      actions.insertBefore(waitMsg, actions.firstChild);
    }
  }

  // Re-render scores — prefer provided evaluation, fall back to cached _evaluation
  const evalToUse = evaluation || rp._evaluation;
  if (evalToUse) renderResults(evalToUse);

  // Add CSS for rankings if not already present
  if (!document.getElementById("rankingsCSS")) {
    const style = document.createElement("style");
    style.id = "rankingsCSS";
    style.textContent = `
      .results-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); }
      .rank-summary { text-align:center; }
      .rank-big { font-size:48px; font-weight:900; color:var(--gold,#ffd700); line-height:1; }
      .rank-sub { font-size:12px; color:var(--muted); margin-top:4px; }
      .my-score { font-size:24px; font-weight:700; color:var(--green); }
      .rankings-list { padding:12px 16px; max-height:320px; overflow-y:auto; }
      .rank-row { display:flex; align-items:center; padding:10px 12px; border-radius:8px; margin-bottom:6px; background:rgba(255,255,255,0.04); }
      .rank-row.rank-me { background:rgba(110,168,254,0.15); border:1px solid rgba(110,168,254,0.4); }
      .rank-medal { font-size:18px; width:32px; text-align:center; }
      .rank-name { flex:1; font-weight:600; color:#e0e8ff; padding-left:8px; }
      .rank-score { font-size:14px; color:var(--green); font-weight:700; }
      .results-actions { padding:16px 20px; border-top:1px solid rgba(255,255,255,0.08); }
      .results-actions button { width:100%; padding:12px; font-size:15px; }
    `;
    document.head.appendChild(style);
  }
}

async function finalize() {
  // CRITICAL: Reset scoreNum immediately so cancel/tx-revert can't show stale 88
  resetScoreDisplay();
  const finalTxt = $("finalTxt");
  const text = finalTxt ? finalTxt.value : "The incident likely occurred during the sensor anomaly and signal spike, but the camera blackout adds uncertainty so manipulation claims must be limited.";

  // Fetch room to get player's fragments (stored in room.players[].fragments)
  let fragments = [];
  let scenarioId = "mystery";
  try {
    const roomData = await api("GET", "/rooms/" + roomCode);
    const me = roomData?.players?.find(p => p.id === playerId || p.id === hostId);
    fragments = me?.fragments?.map(f => typeof f === "string" ? f : f.text || f.content || JSON.stringify(f)) || [];
    scenarioId = roomData?.scenario?.id || "mystery";
  } catch (e) {
    // Room fetch error — continue with defaults
  }

  const matchId = "match_" + roomCode + "_" + Date.now();
  const contributions = [];

  // ── Browser-direct GenLayer call (Gotham Court pattern) ───────────────────
  // MetaMask signs the transaction; GenLayer runs AI consensus evaluation.
  // All validators must agree on LLM scores via strict_eq.
  // Wrap in 90s timeout so slow/unconfirmed TX doesn't freeze the host UI.
  const walletState = window.Wallet?.getState?.();

  let aiResult = null;
  let isOnChain = false;
  let walletCancelled = false;

  if (walletState?.isConnected) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI evaluation timed out (90s)")), 90000)
      );
      aiResult = await Promise.race([
        Wallet.evaluateNarrative(matchId, scenarioId, text, fragments, contributions),
        timeoutPromise
      ]);

      // Parse if contract returned a JSON string
      if (typeof aiResult === "string") {
        try { aiResult = JSON.parse(aiResult); } catch(e) { /* keep as string */ }
      }

      // Contract returns total_score (snake_case)
      // Handle "Undetermined" response (LLM failed to parse, TX reverted on GenLayer)
      const rawResult = typeof aiResult === "string" ? aiResult : "";
      if (rawResult.includes("Undetermined") || rawResult.includes("undetermined")) {
        aiResult = null;
        isOnChain = false;
      } else {
        const aiTotal = aiResult?.total_score || aiResult?.totalScore || 0;
        isOnChain = aiTotal > 0;
      }
    } catch (e) {
      const msg = e?.message || "";
      // Wallet cancelled by user OR evaluation timed out — skip AI, fall through to server
      if (msg.includes("timed out") || e?.code === 4001 || msg.includes("rejected") || msg.includes("cancelled")) {
        walletCancelled = true;
      }
    }
  }

  // ── Only block server submission if user explicitly cancelled (MetaMask rejected) ──
  // Timeout or contract error → still submit to server (rubric fallback applied server-side)
  if (walletCancelled) {
    userIsInteracting = false;
    showToast("Transaction cancelled — sign in MetaMask to finalize", "warn");
    confirmCancel = true;
    return { cancelled: true };
  }

  // Always report to server for room state update
  let data;
  try {
    data = await api("POST", "/rooms/" + roomCode + "/finalize", { playerId: playerId || hostId, text });
  } catch (e) {
    showToast("Finalize cancelled — transaction was not sent", "warn");
    userIsInteracting = false;
    return { cancelled: true };
  }

  // ── Merge AI Consensus result into server response ──────────────────────────
  // After server /finalize returns, inject AI scores so renderResults gets correct score.
  // Solo mode: no separate /ai-result call needed — scores come from here directly.
  if (isOnChain && aiResult) {
    // Contract returns snake_case (evidence, argument, manipulation); normalize to camelCase
    const rawScores = aiResult.scores || aiResult;
    const aiTotal = aiResult.total_score || aiResult.totalScore || 0;
    const normalizedScores = {
      coherence: rawScores.coherence || 0,
      evidenceIntegration: rawScores.evidenceIntegration || rawScores.evidence || 0,
      argumentQuality: rawScores.argumentQuality || rawScores.argument || 0,
      manipulationResistance: rawScores.manipulationResistance || rawScores.manipulation || 0
    };

    // Build full evaluation object from AI result for immediate rendering
    data.evaluation = {
      totalScore: aiTotal,
      aiConsensus: true,
      onChain: true,
      aiScores: normalizedScores,
      rubricScores: normalizedScores
    };
    data.onChain = true;

    // Report to server (non-critical — solo game still works without this)
    try {
      await api("POST", "/rooms/" + roomCode + "/ai-result", {
        matchId,
        scores: normalizedScores,
        totalScore: aiTotal,
        txHash: aiResult.transactionHash
      });
    } catch (e) {
      console.warn("[Finalize] /ai-result failed:", e.message);
    }
  }

  // ── All players finalized — render results with AI scores ──────────────────
  if (data.allFinalized && data.rankings) {
    stopTimerPoll();
    gameFinalized = true;
    currentPhase = "results";
    renderPhaseTimeline("results");
    ["fragPanel","contribPanel","finalizePanel","demoRunPanel","challengePanel"].forEach(id => {
      const el = $(id); if (el) el.style.display = "none";
    });
    // Build evaluation object from AI result if on-chain, else from server data
    let evalForRender = null;
    if (data.onChain && data.evaluation) {
      // On-chain: use the evaluation we just built from GenLayer result
      evalForRender = data.evaluation;
    } else if (data.playerResults) {
      // Off-chain: pull scores from server's playerResults
      const myPlayerId = playerId || hostId;
      const myResult = data.playerResults.find(r => r.id === myPlayerId);
      if (myResult) {
        evalForRender = {
          totalScore: myResult.score || 0,
          aiConsensus: myResult.aiConsensus || false,
          aiScores: myResult.aiScores || myResult.rubricScores || null,
          rubricScores: myResult.rubricScores || myResult.aiScores || null
        };
      }
    }
    const rp = $("resultsPanel");
    if (rp) rp._evaluation = evalForRender;
    if (evalForRender) renderResults(evalForRender);
    renderRankings(data.rankings, myPlayerId, evalForRender);
    userIsInteracting = false;
    const myRank = data.myRank || "?";
    showToast(`Rankings revealed! You're #${myRank}!`, "ok");
    return data;
  }

  // waitingForOthers — don't show score, just acknowledge submission
  if (data.waitingForOthers) {
    gameFinalized = true;
    stopTimerPoll();
    showToast("Waiting for " + (data.pendingPlayers || "?") + " player(s) to finalize...", "ok");
    const btn = $("finalizeBtn");
    if (btn) {
      btn.style.display = "block";
      btn.disabled = true;
      btn.textContent = "⏳ Waiting for other players...";
    }
    userIsInteracting = false;
    return data;
  }

  // TX cancelled or no valid result — don't show fake 88 score
  showToast("Transaction cancelled — please try again", "warn");
  return { cancelled: true };
}

// Poll /rooms/:roomCode until room.evaluation.aiConsensus === true
// GenLayer AI consensus can take 30-90s to compute on-chain.
async function pollAIConsensusResult(roomCode, evaluationId) {
  const maxAttempts = 40;
  const interval = 3000; // 3s between polls
  let aiScores = null;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval));
    try {
      const room = await api("GET", "/rooms/" + roomCode);
      const eval_ = room?.evaluation;
      if (eval_?.aiConsensus && eval_.aiTotalScore > 0) {
        // Build merged evaluation object with AI scores
        return {
          ...eval_,
          totalScore: eval_.aiTotalScore,
          rubricScores: eval_.aiScores || {
            coherence: eval_.aiScores?.coherence || 0,
            evidenceIntegration: eval_.aiScores?.evidence || 0,
            argumentQuality: eval_.aiScores?.argument || 0,
            manipulationResistance: eval_.aiScores?.manipulation || 0
          },
          aiConsensus: true
        };
      }
    } catch (e) {
      // Poll error — continue
    }
  }

  return aiScores; // null = timed out
}

// Helper to get fragments from current room
function getScenarioFragments() {
  // Get from room data or use default
  return window.currentRoomFragments || [];
}

// Helper to get player contributions
function getPlayerContributions() {
  const contribTxt = $("contribTxt");
  return [contribTxt?.value || "Player contribution"];
}

async function submitChallenge() {
  const challengeTxt = $("challengeTxt");
  const correctSel = $("correctSel");
  const reason = challengeTxt ? challengeTxt.value : "";
  const correct = correctSel ? correctSel.value === "true" : true;

  // ── Browser-direct GenLayer challenge resolution ─────────────────────────
  // Calls resolve_challenge() — AI consensus decides validity, XP updated on-chain
  const evaluationId = roomCode;

  if (window.Wallet?.getState?.().isConnected) {
    try {
      await Wallet.resolveChallenge(evaluationId, reason, correct);
    } catch (e) {
      // Wallet challenge resolution error — server fallback
    }
  }

  // Server records challenge locally
  await api("POST", "/rooms/" + roomCode + "/challenges", {
    playerId,
    reason,
    correct
  });
  showToast("Challenge submitted! Waiting for host to close the challenge window...", "ok");
  // Clear the textarea after successful submission
  if (challengeTxt) challengeTxt.value = "";
}

async function showResults() {
  // Fetch authoritative hostId from server in case client hostId is stale/missing
  let reqHostId = hostId;
  if (!reqHostId) {
    try {
      const room = await api("GET", "/rooms/" + roomCode);
      reqHostId = room.hostId;
    } catch(e) { /* fall through */ }
  }
  const data = await api("POST", "/rooms/" + roomCode + "/close-challenge", { hostId: reqHostId });
  renderLeaderboard(data); // renders to both lbBody and lbBody2
  const room = await api("GET", "/rooms/" + roomCode);
  advancePhaseUI("results", room.players);

  // Flash score animation + sound
  const scoreNum = $("scoreNum");
  if (scoreNum) {
    const score = parseInt(scoreNum.textContent) || 0;
    SFX.playScoreReveal(score);
    scoreNum.classList.add("score-flash");
    setTimeout(() => scoreNum.classList.remove("score-flash"), 800);
  }

  // Trigger celebration + confetti
  triggerCelebration(data);

  return data;
}

function triggerCelebration(data) {
  const rows = data?.leaderboard || [];
  const me = rows.find(r => r.playerId === (playerId || hostId)) || rows[0];
  const score = me?.score || 0;
  const rank = me?.rank || 1;
  const xp = me?.xp || 0;

  // Confetti
  triggerConfetti();

  // Show celebration overlay
  const overlay = $("celebrationOverlay");
  const title = $("celebrationTitle");
  const sub = $("celebrationSub");
  if (!overlay) return;

  if (rank === 1) {
    title.textContent = "🏆 1st Place!";
    sub.textContent = `${score} pts — ${xp} XP earned`;
  } else if (rank <= 3) {
    title.textContent = `🎉 Rank #${rank}`;
    sub.textContent = `${score} pts — ${xp} XP earned`;
  } else {
    title.textContent = "✅ Game Complete";
    sub.textContent = `${score} pts — ${xp} XP`;
  }
  overlay.classList.remove("hidden");
}

function triggerConfetti() {
  const canvas = $("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ["#00e5ff","#ff0080","#ffe600","#00ff88","#a855f7"];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5 - canvas.height,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      if (p.y > canvas.height) return;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frame++;
    if (frame < 150) requestAnimationFrame(animate);
    else { ctx.clearRect(0,0,canvas.width,canvas.height); }
  }
  animate();
}

$("closeCelebrationBtn") && ($("closeCelebrationBtn").onclick = () => {
  const overlay = $("celebrationOverlay");
  if (overlay) overlay.classList.add("hidden");
});

$("copyLinkBtn") && ($("copyLinkBtn").onclick = () => {
  const text = `Patchwork Truth — Room ${roomCode} | Score: ${$("scoreNum")?.textContent || "?"}/100 | GenLayer`;
  navigator.clipboard?.writeText(text).then(() => {
    const btn = $("copyLinkBtn");
    if (btn) { btn.textContent = "✓ Copied!"; btn.classList.add("copied"); setTimeout(() => { btn.textContent = "📋 Copy Results"; btn.classList.remove("copied"); }, 2000); }
  });
});

$("copyBadgeBtn") && ($("copyBadgeBtn").onclick = () => {
  const score = $("scoreNum")?.textContent || "?";
  const badge = `🏆 Patchwork Truth | Score: ${score}/100 | GenLayer Community`;
  navigator.clipboard?.writeText(badge).then(() => {
    const btn = $("copyBadgeBtn");
    if (btn) { btn.textContent = "✓ Copied!"; btn.classList.add("copied"); setTimeout(() => { btn.textContent = "🎖️ Copy Badge"; btn.classList.remove("copied"); }, 2000); }
  });
});

// ── UI advance ───────────────────────────────────────────────
function advancePhaseUI(nextPhase, players) {
  if (!roomCode) return;
  ["lobbyPanel","fragPanel","contribPanel","finalizePanel","challengePanel","resultsPanel","leaderboardPanel","demoRunPanel"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = "none";
  });

  // Hide "New Room" button once game starts (lobby → any in-game phase).
  // Prevents host from accidentally leaving while other players are still in the room.
  const resetBtn = $("resetBtn");
  if (resetBtn) {
    resetBtn.style.display = nextPhase === "lobby" ? "" : "none";
  }
  if (nextPhase === "lobby") {
    const lp = $("lobbyPanel");
    if (lp) lp.style.display = "block";
    const rc = $("roomCodeDisplay");
    if (rc) rc.textContent = roomCode || "---";
    const pc = $("playerCountDisplay");
    if (pc) pc.textContent = "1 player joined";
  } else if (nextPhase === "fragment_distribution") {
    const fg = $("fragPanel");
    if (fg) fg.style.display = "block";
    renderFragments(players, playerId || hostId);
  } else if (nextPhase === "negotiation" || nextPhase === "drafting") {
    const cp = $("contribPanel");
    const fp = $("finalizePanel");
    if (cp) { cp.style.display = "block"; cp.classList.add("fade-in"); }
    if (fp) { fp.style.display = "block"; fp.classList.add("fade-in"); }
    // SAFETY: show finalizeBtn only if game hasn't been finalized yet
    // Once any player hits allFinalized, finalizeBtn stays hidden — results panel owns the UI
    const finalizeBtn = $("finalizeBtn");
    if (finalizeBtn && !gameFinalized) {
      finalizeBtn.style.display = "block";
      finalizeBtn.disabled = false;
      finalizeBtn.textContent = "✓ Finalize Narrative";
    }
  } else if (nextPhase === "ai_evaluation" || nextPhase === "evaluation" || nextPhase === "e_evaluation") {
    // AI Evaluation phase → show ONLY results (score breakdown), no challenge yet
    const rp = $("resultsPanel");
    if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
    // Reset scoreNum so stale score from previous session doesn't bleed through
    resetScoreDisplay();
    // Show next phase button only for host
    const nextBtn = $("nextPhaseBtn");
    const waitMsg = $("waitingHostMsg");
    if (nextBtn) nextBtn.style.display = hostId ? "block" : "none";
    if (waitMsg) waitMsg.style.display = hostId ? "none" : "block";
  } else if (nextPhase === "challenge_window") {
    // Challenge window → show challenge form + results (score visible for reference)
    const cp = $("challengePanel");
    const rp = $("resultsPanel");
    if (cp) cp.style.display = "block";
    if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
    // Reset scoreNum so stale score from previous session doesn't bleed through
    resetScoreDisplay();
    // Hide next phase button in challenge window (host uses hcChallengeBtn)
    const nextBtn = $("nextPhaseBtn");
    const waitMsg = $("waitingHostMsg");
    if (nextBtn) nextBtn.style.display = "none";
    if (waitMsg) waitMsg.style.display = "none";
    // Hide Play Again button in challenge phase — only show at final results phase
    const playAgain = $("playAgainBtn");
    if (playAgain) playAgain.style.display = "none";
  } else if (nextPhase === "results") {
    const rp = $("resultsPanel");
    const lbEmbedded = $("resultsLeaderboard");
    const playAgain = $("playAgainBtn");
    if (rp) rp.style.display = "block";
    if (lbEmbedded) lbEmbedded.style.display = "block";
    // Hide challenge panel when entering results phase (may still be visible from challenge_window)
    const challengePanel = $("challengePanel");
    if (challengePanel) challengePanel.style.display = "none";
    // Ensure scoreNum is in clean state for results phase
    resetScoreDisplay();
    if (playAgain) playAgain.style.display = "block";
  }
}

// advanceUI — status bar sync only, no panel changes from poll
function advanceUI(room) {
  if (!roomCode) return;
  const phase = room?.phase || currentPhase;
  updateStatus(room);
  currentPhase = phase;
}

// Show lobby panel with room info
function showLobbyPanel(room) {
  const rcDisplay = $("roomCodeDisplay");
  const pcDisplay = $("playerCountDisplay");
  if (rcDisplay) rcDisplay.textContent = roomCode || "---";
  if (pcDisplay) pcDisplay.textContent = room
    ? `${room.playerCount || 1} players joined`
    : "Waiting for players...";
}

// ── Event listeners ─────────────────────────────────────────
$("playBtn") && ($("playBtn").onclick = async () => {
  // Prefer wallet name, fallback to playerName global, then prompt
  const name = val("playerNameInput") || playerName;
  if (!name) { showToast("Enter your name first!", "warn"); return; }
  showGame();
  const btn = $("playBtn");
  if (btn) { btn.textContent = "⏳ Creating room..."; btn.disabled = true; }
  try {
    await createRoom(name);
    showToast("Room " + roomCode + " created!", "ok");
    const lobbyPanel = $("lobbyPanel");
    const hostBar = $("hostControlBar");
    const destroyBtn = $("destroyRoomBtn");
    const leaveBtn = $("leaveRoomBtn");
    if (lobbyPanel) { lobbyPanel.style.display = "block"; lobbyPanel.classList.add("fade-in"); }
    if (hostBar) { hostBar.classList.remove("hidden"); }
    // Host sees Destroy Room; others see Leave Room
    if (destroyBtn) destroyBtn.style.display = "block";
    if (leaveBtn) leaveBtn.style.display = "none";
    ["fragPanel","contribPanel","finalizePanel","challengePanel","resultsPanel","leaderboardPanel","demoRunPanel"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    updateStatus({ phase: "lobby", roomCode });
  } catch (err) { showToast("Failed to create room: " + err.message, "warn"); showMenu(); }
  if (btn) { btn.textContent = "Play"; btn.disabled = false; }
});

$("joinRoomBtn") && ($("joinRoomBtn").onclick = async () => {
  const name = val("playerNameInput") || playerName;
  const code = val("joinRoomCodeInput");
  if (!name) { showToast("Enter your name first!", "warn"); return; }
  if (!code) { showToast("Enter the room code!", "warn"); return; }
  const btn = $("joinRoomBtn");
  if (btn) { btn.textContent = "⏳ Joining..."; btn.disabled = true; }
  showGame();
  try {
    await joinRoom(name, code);
    showToast("Joined room " + roomCode + "!", "ok");
    // Show Leave Room for non-host
    const destroyBtn = $("destroyRoomBtn");
    const leaveBtn = $("leaveRoomBtn");
    if (destroyBtn) destroyBtn.style.display = "none";
    if (leaveBtn) leaveBtn.style.display = "block";
  } catch (err) { showMenu(); }
  if (btn) { btn.textContent = "Join Room"; btn.disabled = false; }
});

$("startMatchBtn") && ($("startMatchBtn").onclick = async () => {
  const btn = $("startMatchBtn");
  if (btn) { btn.textContent = "⏳ Memulai..."; btn.disabled = true; }
  try {
    const currentRoom = await api("GET", "/rooms/" + roomCode);
    if (currentRoom.phase !== "lobby") {
      speedMode = currentRoom.speedMode || false;
      isSolo = currentRoom.playerCount === 1;
      advancePhaseUI(currentRoom.phase, currentRoom.players);
      updateStatus(currentRoom);
      // Sync scenario for non-host players
      if (currentRoom.scenario) {
        selectedScenario = currentRoom.scenario.id || "mystery";
        const scenarioChip = $("scenarioChip");
        if (scenarioChip) {
          scenarioChip.textContent = `${currentRoom.scenario.emoji || "📋"} ${currentRoom.scenario.label}`;
          scenarioChip.style.display = "inline-flex";
        }
      }
      startTimerPoll();
    } else {
      await startMatch();
      showToast("Game started! ⚡", "ok");
    }
  } catch (err) { showToast("Error: " + err.message, "warn"); }
  if (btn) { btn.textContent = "▶ Start Game Now"; btn.disabled = false; }
});

$("inviteBtn") && ($("inviteBtn").onclick = () => {
  const name = val("playerNameInput") || playerName || "Guest";
  const url = `${window.location.origin}${window.location.pathname}?join=${roomCode}&name=${encodeURIComponent(name)}`;
  navigator.clipboard?.writeText(url).then(() => {
    const btn = $("inviteBtn");
    if (btn) { btn.textContent = "✓ Link copied!"; setTimeout(() => { btn.textContent = "🔗 Copy Room Link"; }, 2000); }
  });
});

// Destroy Room — only visible to host; kicks all non-host players back to menu
$("destroyRoomBtn") && ($("destroyRoomBtn").onclick = async () => {
  const btn = $("destroyRoomBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  try {
    await api("POST", "/rooms/" + roomCode + "/destroy", { hostId });
    stopTimerPoll();
    stopLobbyPoll();
    showMenu();
    resetState();
    showToast("Room destroyed", "ok");
  } catch (err) {
    showToast("Error: " + err.message, "warn");
    if (btn) { btn.textContent = "⛔ Destroy Room"; btn.disabled = false; }
  }
});

// Leave Room — visible to all non-host players; host sees Destroy Room instead
$("leaveRoomBtn") && ($("leaveRoomBtn").onclick = () => {
  stopTimerPoll();
  stopLobbyPoll();
  showMenu();
  resetState();
  showToast("You left the room", "ok");
});

$("showGuideBtn") && ($("showGuideBtn").onclick = () => { showGuide(); });

$("introBackBtn") && ($("introBackBtn").onclick = () => { showMenu(); resetState(); });

$("backToMenuBtn") && ($("backToMenuBtn").onclick = () => { showMenu(); resetState(); });

$("resetBtn") && ($("resetBtn").onclick = () => { showMenu(); resetState(); });

$("soundToggle") && ($("soundToggle").onclick = () => {
  const muted = SFX.toggleMute();
  const onIcon = $("soundOnIcon");
  const offIcon = $("soundOffIcon");
  const btn = $("soundToggle");
  if (onIcon) onIcon.style.display = muted ? "none" : "block";
  if (offIcon) offIcon.style.display = muted ? "block" : "none";
  if (btn) btn.classList.toggle("muted", muted);
});

$("fragNextBtn") && ($("fragNextBtn").onclick = async () => {
  const btn = $("fragNextBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  if (!hostId) { showToast("Only host can advance phase", "warn"); if (btn) { btn.textContent = "Next to Contribution →"; btn.disabled = false; } return; }
  try {
    // Multiplayer: host starts ready countdown first, then advances
    const roomBefore = await api("GET", "/rooms/" + roomCode);
    const isMulti = roomBefore.playerCount > 1 && !roomBefore.speedMode;
    const nextPhase = "negotiation";

    if (isMulti) {
      // Step 1: Start ready countdown (players get 10s to click READY)
      let cdResult;
      cdResult = await api("POST", "/rooms/" + roomCode + "/start-ready-countdown", { hostId });
        showToast("⏰ All players must READY up! 10s countdown...", "warn");
      // Step 2: Poll until all ready OR countdown expires + host retries
      const maxWait = 15; // wait up to 15s
      for (let i = 0; i < maxWait; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const room = await api("GET", "/rooms/" + roomCode);
        updateReadyBanner(room);
        const remaining = room.readyTimeout?.remainingSeconds;
        const allReady = room.allReady;
        if (allReady) { showToast("All players ready! Advancing...", "ok"); break; }
        if (remaining === 0 || (remaining === null && !room.waitingForReady)) { break; }
      }
    }

    // Step 3: Advance phase (kicks not-ready players automatically)
    const room = await api("POST", "/rooms/" + roomCode + "/advance-phase", { hostId });
    const room2 = await api("GET", "/rooms/" + roomCode);
    const fg = $("fragPanel");
    const cp = $("contribPanel");
    const fp = $("finalizePanel");
    const dp = $("demoRunPanel");
    if (fg) fg.style.display = "none";
    if (cp) { cp.style.display = "block"; cp.classList.add("fade-in"); }
    if (fp) { fp.style.display = "block"; fp.classList.add("fade-in"); }
    if (dp) dp.style.display = "none";
    updateStatus(room2);
    updateReadyBanner(room2);
    showToast("Moving to negotiation phase!", "");
  } catch(e) { showToast("Error: " + e.message, "warn"); }
  if (btn) { btn.textContent = "Next to Contribution →"; btn.disabled = false; }
});

$("submitContribBtn") && ($("submitContribBtn").onclick = async () => {
  const btn = $("submitContribBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  try {
    // Verify server phase before submitting
    const roomBefore = await api("GET", "/rooms/" + roomCode);
    const phase = roomBefore?.phase;
    const allowed = ["fragment_distribution", "negotiation", "drafting"];
    if (!allowed.includes(phase)) {
      showToast("Contribution phase ended — waiting for host...", "warn");
      if (btn) { btn.textContent = "Submit Contribution"; btn.disabled = false; }
      return;
    }
    await submitContrib();
    // Only host can advance phase — non-host can't (hostId is null for them)
    if (hostId) {
      try { await api("POST", "/rooms/" + roomCode + "/advance-phase", { hostId }); } catch (_) {}
    }
    const room = await api("GET", "/rooms/" + roomCode);
    const cp = $("contribPanel");
    const fp = $("finalizePanel");
    const dp = $("demoRunPanel");
    const fg = $("fragPanel");
    if (cp) { cp.style.display = "block"; cp.classList.add("fade-in"); }
    if (fp) { fp.style.display = "block"; fp.classList.add("fade-in"); }
    if (dp) dp.style.display = "none";
    if (fg) fg.style.display = "none";
    updateStatus(room);
    // Sync tab bar AND panels to actual server phase so pill highlights AND panels match
    renderPhaseTimeline(room?.phase || "drafting");
    advancePhaseUI(room?.phase || "drafting", room?.players);
    showToast("Contribution submitted!", "ok");
  } catch(e) { showToast("Error: " + e.message, "warn"); }
  if (btn) { btn.textContent = "Submit Contribution"; btn.disabled = false; }
});
$("finalizeBtn") && ($("finalizeBtn").onclick = async () => {
  const btn = $("finalizeBtn");
  // Prevent double-submit: if already in progress, ignore
  if ($("finalizeBtn")?.disabled || btn?.dataset.submitting === "1") return;
  if (btn) { btn.dataset.submitting = "1"; btn.textContent = "⏳..."; btn.disabled = true; }
  userIsInteracting = true;
  resetScoreDisplay();
  // Hard timeout: if finalize doesn't complete in 120s, release UI anyway
  const hardTimeout = setTimeout(() => {
    userIsInteracting = false;
    showToast("Finalize took too long — please try again", "warn");
    if (btn) { btn.dataset.submitting = "0"; btn.textContent = "✓ Finalize Narrative"; btn.disabled = false; }
  }, 120000);
  try {
    const result = await submitFinalize();
    clearTimeout(hardTimeout);
    if (btn) { btn.dataset.submitting = "0"; }

    if (!result) {
      userIsInteracting = false;
      showToast("Finalize error — no response from server", "warn");
      if (btn) { btn.textContent = "✓ Finalize Narrative"; btn.disabled = false; }
      return;
    }

    if (result.waitingForOthers) {
      gameFinalized = true;
      userIsInteracting = false;
      stopTimerPoll();
      showToast("Your narrative saved! Waiting for " + result.pendingPlayers + " other player(s)...", "ok");
      // Keep btn disabled with "⏳" text — wait for batch-finalize to show results together.
      // DO NOT show results panel here — all players must finish before results appear.
      if (btn) {
        btn.style.display = "block";
        btn.disabled = true;
        btn.textContent = "⏳ Waiting for other players...";
      }
      startWaitingPoll(result.pendingPlayers);
      return;
    }

    if (result.allFinalized) {
      stopTimerPoll();
      gameFinalized = true;
      currentPhase = "results";
      renderPhaseTimeline("results");
      // Hide all game panels
      ["fragPanel","contribPanel","finalizePanel","demoRunPanel","challengePanel"].forEach(id => {
        const el = $(id); if (el) el.style.display = "none";
      });
      if (btn) { btn.style.display = "none"; }
      // Show results panel
      const rp = $("resultsPanel");
      if (rp) { rp.style.display = "block"; rp.classList.add("fade-in"); }
      // Build evaluation from server playerResults (with normalized per-dimension scores)
      let evalForRender = null;
      const myPlayerId = playerId || hostId;
      if (result.playerResults) {
        const myResult = result.playerResults.find(r => r.id === myPlayerId);
        if (myResult) {
          evalForRender = {
            totalScore: myResult.score || 0,
            aiConsensus: myResult.aiConsensus || false,
            aiScores: myResult.aiScores || myResult.rubricScores || null,
            rubricScores: myResult.rubricScores || myResult.aiScores || null
          };
        }
      } else if (result.rankings) {
        // Legacy fallback (playerResults not in response): use rankings score only
        evalForRender = {
          totalScore: result.myScore || 0,
          aiConsensus: false,
          aiScores: null,
          rubricScores: null
        };
      }
      if (rp) rp._evaluation = evalForRender;
      if (evalForRender) renderResults(evalForRender);
      if (result.rankings) {
        renderRankings(result.rankings, myPlayerId, evalForRender);
      } else {
        // No rankings in response — fetch from server
        try {
          const roomData = await api("GET", "/rooms/" + roomCode);
          if (roomData.playerResults) renderRankings(roomData.playerResults, myPlayerId, null);
          if (roomData.playerResults && roomData.playerResults.length > 0) {
            const myResult = roomData.playerResults.find(r => r.id === myPlayerId);
            if (myResult) {
              const evalFromServer = {
                totalScore: myResult.score || 0,
                aiConsensus: myResult.aiConsensus || false,
                aiScores: myResult.aiScores || myResult.rubricScores || null,
                rubricScores: myResult.rubricScores || myResult.aiScores || null
              };
              if (rp) rp._evaluation = evalFromServer;
              renderResults(evalFromServer);
            }
          }
        } catch (_) {}
      }
      showToast("Rankings revealed! You're #" + result.myRank + " of " + result.totalPlayers, "ok");
      startPostFinalizePoll();  // Poll for re-rank when host AI scores arrive
      userIsInteracting = false;
      return;
    }

    // Cancelled or any non-allFinalized outcome — HIDE result panel to prevent stale 88
    const rp = $("resultsPanel");
    if (rp) { rp.style.display = "none"; rp.innerHTML = ""; }
    userIsInteracting = false;
    if (btn) { btn.textContent = "✓ Finalize Narrative"; btn.disabled = false; }
  } catch(e){
    clearTimeout(hardTimeout);
    if (btn) { btn.dataset.submitting = "0"; }
    showToast("Finalize error: " + e.message, "warn");
    userIsInteracting = false;
    if (btn) { btn.textContent = "✓ Finalize Narrative"; btn.disabled = false; }
  }
});

// Next phase button (results panel) — removed duplicate; nextPhaseBtn is injected
// dynamically by renderRankings() for host and uses that onclick instead.

$("submitChallengeBtn") && ($("submitChallengeBtn").onclick = async () => {
  const btn = $("submitChallengeBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  try {
    await submitChallenge();
    showToast("Challenge submitted!", "ok");
    if (btn) { btn.textContent = "✓ Submitted!"; btn.disabled = false; }
    setTimeout(() => { if (btn) { btn.textContent = "Submit Challenge"; } }, 3000);
  } catch(e){ showToast("Error: " + e.message, "warn"); if (btn) { btn.textContent = "Submit Challenge"; btn.disabled = false; } }
});
$("showLBBtn") && ($("showLBBtn").onclick = async () => { try { await showResults(); showToast("Game results!", ""); } catch(e){showToast("Error: " + e.message, "warn");} });
$("goToResultBtn") && ($("goToResultBtn").onclick = async () => {
  // If host, close challenge first using authoritative hostId from server
  if (hostId || roomCode) {
    try {
      let reqHostId = hostId;
      if (!reqHostId) {
        const room = await api("GET", "/rooms/" + roomCode);
        reqHostId = room.hostId;
      }
      await api("POST", "/rooms/" + roomCode + "/close-challenge", { hostId: reqHostId });
    } catch(e) { /* ignore if already closed */ }
  }
  // Manually show results panel and hide challenge panel
  const rp = $("resultsPanel");
  const cp = $("challengePanel");
  const playAgain = $("playAgainBtn");
  if (cp) cp.style.display = "none";
  if (rp) rp.style.display = "block";
  if (playAgain) playAgain.style.display = "block";
  renderPhaseTimeline("results");
  showToast("Game complete!", "ok");
});
// ── Host controls (advanced mode) ───────────────────────────
$("hcAdvanceBtn") && ($("hcAdvanceBtn").onclick = async () => {
  const btn = $("hcAdvanceBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  // Fetch authoritative hostId from server
  let reqHostId = hostId;
  if (!reqHostId && roomCode) {
    try {
      const room = await api("GET", "/rooms/" + roomCode);
      reqHostId = room.hostId;
    } catch(e) {}
  }
  if (!reqHostId) { showToast("Host ID not found", "warn"); if (btn) { btn.textContent = "▶ Next Phase"; btn.disabled = false; } return; }
  try {
    const res = await fetch(API_BASE + "/rooms/" + roomCode + "/advance-phase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hostId: reqHostId })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast("Cannot proceed:  " + (err.error || res.statusText), "warn");
      if (btn) { btn.textContent = "▶ Next Phase"; btn.disabled = false; }
      return;
    }
    const room = await api("GET", "/rooms/" + roomCode);
    advancePhaseUI(room.phase, room.players);
    updateStatus(room);
    showToast("Moving to: " + room.phase, "");
  } catch (e) { showToast("Error: " + e.message, "warn"); }
  if (btn) { btn.textContent = "▶ Next Phase"; btn.disabled = false; }
});

$("hcFinalizeBtn") && ($("hcFinalizeBtn").onclick = async () => {
  const btn = $("hcFinalizeBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  try {
    const result = await submitFinalize({ forceHostId: true });
    // Reset scoreNum on any non-allFinalized outcome (cancelled, waiting, error)
    if (!result?.allFinalized) {
      const sn = $("scoreNum");
      if (sn) sn.textContent = "--";
    }
    if (result?.allFinalized) {
      showToast("All narratives evaluated! See rankings.", "ok");
    } else if (result?.waitingForOthers) {
      showToast("Your narrative saved! Waiting for others...", "ok");
      if (btn) { btn.textContent = "Waiting..."; btn.disabled = true; }
    }
  } catch (e) { showToast("Finalize error: " + e.message, "warn"); }
  if (btn && btn.disabled) { btn.textContent = "✔ Finalize"; btn.disabled = false; }
});

$("hcChallengeBtn") && ($("hcChallengeBtn").onclick = async () => {
  const btn = $("hcChallengeBtn");
  if (btn) { btn.textContent = "⏳..."; btn.disabled = true; }
  // Fetch authoritative hostId from server — client hostId may be stale/missing
  let reqHostId = hostId;
  if (!reqHostId) {
    try {
      const room = await api("GET", "/rooms/" + roomCode);
      reqHostId = room.hostId;
    } catch(e) { /* fall through with empty */ }
  }
  if (!reqHostId) { showToast("Host ID not found — cannot close challenge", "warn"); if (btn) { btn.textContent = "Close Challenge"; btn.disabled = false; } return; }
  try {
    const data = await api("POST", "/rooms/" + roomCode + "/close-challenge", { hostId: reqHostId });
    renderLeaderboard(data);
    const room = await api("GET", "/rooms/" + roomCode);
    advancePhaseUI("results", room.players);
    triggerCelebration(data);
  } catch (e) { showToast("Close challenge error: " + e.message, "warn"); }
  if (btn) { btn.textContent = "Close Challenge"; btn.disabled = false; }
});

// Show host controls when hostId matches
function updateHostControls() {
  const bar = $("hostControlBar");
  const badge = $("hostBadge");
  const isHost = Boolean(roomCode && hostId);
  if (bar) bar.classList.toggle("hidden", !isHost);
  if (badge) badge.style.display = isHost ? "inline-flex" : "none";
}

$("playAgainBtn") && ($("playAgainBtn").onclick = () => { showMenu(); resetState(); });
$("fillContribBtn") && ($("fillContribBtn").onclick = _fillContrib);
$("fillNarrBtn") && ($("fillNarrBtn").onclick = _fillNarr);

// ── Accordion helper (for guide) ────────────────────────────
function toggleAccordion(btn) {
  const body = btn.nextElementSibling;
  if (!body) return;
  const isOpen = body.style.display === "block";
  body.style.display = isOpen ? "none" : "block";
  btn.querySelector("span") && (btn.querySelector("span").textContent = isOpen ? "" : "");
}

// ── Scenario selector for advanced setup ─────────────────────
function renderAdvScenarioSelector() {
  const row = $("advScenarioRow");
  if (!row || !scenarios.length) return;
  row.innerHTML = scenarios.map(s => `
    <button class="scenario-btn ${s.id === selectedScenario ? 'active' : ''}" data-id="${s.id}">
      <span class="sc-emoji">${s.emoji || "📋"}</span>
      <span class="sc-label">${s.label}</span>
    </button>
  `).join("");
  row.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.onclick = () => {
      selectedScenario = btn.dataset.id;
      row.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
}

// ── Difficulty buttons ────────────────────────────────────────
function setupDifficultyButtons() {
  const grid = $("diffGrid");
  if (!grid) return;
  grid.querySelectorAll(".adv-diff-btn").forEach(btn => {
    btn.onclick = () => {
      selectedDifficulty = btn.dataset.diff;
      grid.querySelectorAll(".adv-diff-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
}

// ── Menu navigation ───────────────────────────────────────────
function requireWallet() {
  if (!playerAddress) {
    showToast("Please connect wallet first!", "warn");
    return false;
  }
  return true;
}

const menuQ = document.getElementById("menuQuickBtn");
if (menuQ) menuQ.onclick = (e) => {
  e.stopPropagation();
  if (!requireWallet()) return;
  // Show intro screen so player can see scenario & speed mode options
  showIntro();
};

const menuA = document.getElementById("menuAdvancedBtn");
if (menuA) menuA.onclick = (e) => { e.stopPropagation(); if (requireWallet()) showAdvancedSetup(); };

const menuG = document.getElementById("menuGuideBtn");
if (menuG) menuG.onclick = (e) => { e.stopPropagation(); showGuide(); };

const menuL = document.getElementById("menuLeaderboardBtn");
if (menuL) menuL.onclick = (e) => { e.stopPropagation(); showLeaderboard(); };

// ── Back buttons ────────────────────────────────────────────────
const guideBack = document.getElementById("guideBackBtn");
if (guideBack) guideBack.onclick = (e) => { e.stopPropagation(); showMenu(); };

const advBack = document.getElementById("advBackBtn");
if (advBack) advBack.onclick = (e) => { e.stopPropagation(); showMenu(); };

const lbBack = document.getElementById("lbBackBtn");
if (lbBack) lbBack.onclick = (e) => { e.stopPropagation(); showMenu(); };

const lbPlay = document.getElementById("lbPlayBtn");
if (lbPlay) lbPlay.onclick = (e) => { e.stopPropagation(); showMenu(); };

// ── Guide tab switching ────────────────────────────────────────
$("guideTabs") && $("guideTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".guide-tab");
  if (!tab) return;
  const tabId = tab.dataset.tab;
  $("guideTabs").querySelectorAll(".guide-tab").forEach(t => t.classList.remove("active"));
  tab.classList.add("active");
  document.querySelectorAll(".guide-section").forEach(s => s.classList.remove("active"));
  const sec = $("sec-" + tabId);
  if (sec) sec.classList.add("active");
});

// ── Leaderboard tab switching ──────────────────────────────────
$("lbTabScore") && $("lbTabScore").addEventListener("click", (e) => {
  e.stopPropagation();
  if ($("lbTabScore").classList.contains("active")) return;
  document.querySelectorAll(".lb-tab").forEach(t => t.classList.remove("active"));
  $("lbTabScore").classList.add("active");
  loadGlobalLeaderboard("score");
});
$("lbTabXp") && $("lbTabXp").addEventListener("click", (e) => {
  e.stopPropagation();
  if ($("lbTabXp").classList.contains("active")) return;
  document.querySelectorAll(".lb-tab").forEach(t => t.classList.remove("active"));
  $("lbTabXp").classList.add("active");
  loadGlobalLeaderboard("xp");
});

// ── Leaderboard data loading ───────────────────────────────────
let lbLoading = false;
let lbPollingInterval = null;

async function loadGlobalLeaderboard(filter = "score") {
  const body = $("lbBody");
  if (!body) return;
  if (lbLoading) return;
  lbLoading = true;

  // Don't clear with spinner — entries appear silently when ready

  try {
    // Try reading from contract first (on-chain, real-time)
    let data = null;
    if (Wallet && Wallet.getState().isConnected) {
      try {
        data = await Wallet.read("get_leaderboard");
        if (data && typeof data === "string") {
          data = JSON.parse(data);
        }
      } catch(e) {
        console.warn("[Contract] get_leaderboard failed:", e.message);
      }
    }

    // Fallback to server if contract fails
    if (!data) {
      const serverData = await api("GET", `/leaderboard?filter=${filter}`);
      data = serverData.leaderboard || [];
    }

    lbLoading = false;

    if (!data || data.length === 0) {
      body.innerHTML = '<p class="lb-empty-msg">No players yet. Be the first!</p>';
      return;
    }

    renderLeaderboardEntries(body, data);

    // Show player's own rank — use wallet address if connected, skip if not connected
    const wState = Wallet?.getState();
    const playerAddr = wState?.address;
    if (playerAddr) {
      try {
        const playerData = await api("GET", `/leaderboard/player/${encodeURIComponent(playerAddr)}`);
        if (playerData.score > 0) {
          const prBox = $("lbPlayerRank");
          if (prBox) {
            prBox.style.display = "block";
            $("lbPrScore").textContent = playerData.score;
            $("lbPrRank").textContent = `Rank #${playerData.rank || "?"}`;
          }
        }
      } catch (_) {}
    }
  } catch (err) {
    lbLoading = false;
    body.innerHTML = '<div class="lb-loading"><p class="lb-empty-msg">Failed to load leaderboard</p></div>';
  }
}

function renderLeaderboardEntries(body, entries) {
  body.innerHTML = entries.map((entry, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? "top1" : rank === 2 ? "top2" : rank === 3 ? "top3" : "";
    // Use readable name — prioritize stored name, skip if it looks like a raw address.
    // If name is missing/too-short/an address-like, try player_address field from contract.
    const rawName = entry.name || "";
    const looksLikeAddress = rawName.startsWith("0x") && rawName.length > 35;
    const displayName = (!looksLikeAddress && rawName.length > 2)
      ? rawName
      : (entry.player_address || entry.address || "?").slice(0, 8) + "...";
    const wState = Wallet?.getState();
    const myAddr = wState?.address;
    const isMe = myAddr
      ? (entry.player_address === myAddr || entry.address === myAddr)
      : (playerName && entry.name === playerName);
    return `
      <div class="lb-entry ${isMe ? "lb-entry-me" : ""}">
        <div class="lb-rank ${rankClass}">#${rank}</div>
        <div class="lb-name">${displayName}${isMe ? " (kamu)" : ""}</div>
        <div class="lb-score">${entry.score || 0}</div>
        <div class="lb-games">${entry.xp || entry.gamesPlayed || 0} XP</div>
      </div>
    `;
  }).join("");
}

// Start real-time polling when leaderboard screen is shown
const origShowLeaderboard = showLeaderboard;
showLeaderboard = async function() {
  origShowLeaderboard();
  // Start polling every 5 seconds — silent update, no loading spinner
  if (lbPollingInterval) clearInterval(lbPollingInterval);
  lbPollingInterval = setInterval(async () => {
    if (document.getElementById("leaderboardScreen")?.classList.contains("active")) {
      try {
        const activeTab = document.querySelector(".lb-tab.active");
        const filterKey = activeTab?.id === "lbTabXp" ? "xp" : "score";
        const body = $("lbBody");

        let data = null;
        if (Wallet && Wallet.getState().isConnected) {
          try {
            data = await Wallet.read("get_leaderboard");
            if (data && typeof data === "string") data = JSON.parse(data);
          } catch(e) {}
        }
        if (!data) {
          const serverData = await api("GET", `/leaderboard?filter=${filterKey}`);
          data = serverData.leaderboard || [];
        }
        if (data && data.length > 0) {
          renderLeaderboardEntries(body, data);
        }
      } catch (_) {}
    }
  }, 5000);
};

// Stop polling when leaving leaderboard
const origShowMenu = showMenu;
showMenu = function() {
  if (lbPollingInterval) {
    clearInterval(lbPollingInterval);
    lbPollingInterval = null;
  }
  resetState();  // always clean slate when returning to menu
  origShowMenu();
};

// ── Advanced form submission ───────────────────────────────────
$("advStartBtn") && ($("advStartBtn").onclick = async () => {
  const hostName = val("advHostName") || "Host";
  showGame();

  // Apply advanced settings to global state
  speedMode = $("advSpeedMode")?.checked ?? true;
  selectedDifficulty = document.querySelector(".adv-diff-btn.active")?.dataset.diff || "easy";

  try {
    await createRoom(hostName);
    advanceUI({ phase: "lobby" });
    showToast("Room " + roomCode + " created!", "ok");
  } catch (err) {
    showToast("Failed to create room: " + err.message, "warn");
  }
});

// ── Disconnect / Room expired overlay ───────────────────────
let disconnectShown = false;
function showDisconnect(title, msg) {
  if (disconnectShown) return;
  disconnectShown = true;
  stopTimerPoll();
  stopLobbyPoll();
  const overlay = $("disconnectOverlay");
  const titleEl = $("disconnectTitle");
  const msgEl = $("disconnectMsg");
  if (overlay) { overlay.classList.remove("hidden"); overlay.classList.add("fade-in"); }
  if (titleEl) titleEl.textContent = title || "Connection Lost";
  if (msgEl) msgEl.textContent = msg || "You have been disconnected from the room.";
}
function hideDisconnect() {
  disconnectShown = false;
  const overlay = $("disconnectOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ── Init ──────────────────────────────────────────────────────
async function loadScenarios() {
  try {
    const data = await api("GET", "/scenarios");
    scenarios = data.scenarios || [];
    renderScenarioSelector();
  } catch (e) {
    scenarios = [
      { id: "mystery", label: "Mystery Investigation", emoji: "🔍" },
      { id: "scifi", label: "Space Crisis", emoji: "🛸" },
      { id: "politics", label: "Political Contract", emoji: "🏛️" },
      { id: "conspiracy", label: "Conspiracy Theory", emoji: "🕵️" }
    ];
    renderScenarioSelector();
  }
}

function renderScenarioSelector() {
  const row = $("scenarioRow");
  if (!row) return;
  row.innerHTML = scenarios.map(s => `
    <button class="scenario-btn ${s.id === selectedScenario ? 'active' : ''}" data-id="${s.id}">
      <span class="sc-emoji">${s.emoji || "📋"}</span>
      <span class="sc-label">${s.label}</span>
    </button>
  `).join("");
  row.querySelectorAll(".scenario-btn").forEach(btn => {
    btn.onclick = () => {
      selectedScenario = btn.dataset.id;
      row.querySelectorAll(".scenario-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });
}

loadScenarios();
setupDifficultyButtons();
// Restore playerName from localStorage BEFORE initWalletUI so it's ready immediately
const preSavedName = localStorage.getItem("pt_playerName");
if (preSavedName) playerName = preSavedName;
// Also pre-fill name input if it still exists in DOM
const nameInputEl = $("playerNameInput");
if (nameInputEl && preSavedName) nameInputEl.value = preSavedName;

// initWalletUI must run BEFORE showMenu — wallet must finish loading before UI renders
// localStorage restore above ensures playerName is non-empty even while wallet async loads
initWalletUI().then(() => {
  showMenu();
  // After wallet finishes loading, sync wallet state on top of pre-filled localStorage values
  const state = Wallet.getState();
  if (state.isConnected) {
    playerAddress = state.address || playerAddress;
    // Only fill playerName from wallet if localStorage is empty (wallet wins if no localStorage)
    if (!playerName && state.playerName) playerName = state.playerName;
  }
});

// ── Deep-link: ?join=ROOMCODE auto-join ─────────────────────
(() => {
  const params = new URLSearchParams(window.location.search);
  const joinCode = params.get("join");
  if (joinCode) {
    // Clean the URL without reloading
    window.history.replaceState({}, "", window.location.pathname);
    const name = params.get("name") || playerName || "Guest";
    // Show a banner then attempt join
    showToast("Joining room " + joinCode + "...", "");
    setTimeout(async () => {
      try {
        await joinRoom(name, joinCode);
      } catch (e) {
        showToast("Could not join room: " + joinCode, "warn");
      }
    }, 500);
  }
})();
$("disconnectBackBtn") && ($("disconnectBackBtn").onclick = () => { hideDisconnect(); showMenu(); resetState(); });

// ── Wallet Integration ────────────────────────────────────────────
async function initWalletUI() {
  // Connect/disconnect wallet button
  const walletBtn = $("walletConnectBtn");
  if (walletBtn) {
    walletBtn.onclick = async () => {
      // Always ask MetaMask directly at click time
      let metaMaskConnected = false;
      if (window.ethereum) {
        try { const a = await window.ethereum.request({ method: "eth_accounts" }); metaMaskConnected = !!a?.length; }
        catch (_) {}
      }

      if (metaMaskConnected) {
        Wallet.disconnect();
        playerAddress = "";
        playerName = "";
        updateWalletUI(Wallet.getState());
        showToast("Wallet disconnected", "");
      } else {
        try {
          await Wallet.connect();
          updateWalletUI(Wallet.getState());
          const stateAfter = Wallet.getState();
          if (!stateAfter.playerRegistered) {
            showNameModal();
          } else {
            playerName = stateAfter.playerName || "";
          }
        } catch(e) {
          showToast("Wallet: " + e.message, "warn");
          updateWalletUI(Wallet.getState());
        }
      }
    };
  }

  // Init wallet — wait for it to finish loading before syncing state
  Wallet.init().then(() => {
    // Listen for wallet changes
    Wallet.onChange((state) => {
      // Sync wallet state to main.js globals
      if (state.isConnected) {
        playerAddress = state.address || playerAddress;
        playerName = state.playerName || playerName || "";
      } else {
        playerAddress = "";
        playerName = "";
      }
      updateWalletUI(state);
    });

    // Sync initial state from wallet
    const state = Wallet.getState();
    if (state.isConnected) {
      playerAddress = state.address || playerAddress;
      playerName = state.playerName || playerName || "";
    }
    updateWalletUI(state);
  });

  // Save name button
  const saveNameBtn = $("saveNameBtn");
  if (saveNameBtn) {
    saveNameBtn.onclick = async () => {
      const nameInput = $("nameInput");
      const name = nameInput?.value?.trim() || "";
      if (name.length < 2 || name.length > 24) {
        showToast("Name must be 2-24 characters", "warn");
        return;
      }
      try {
        await Wallet.savePlayerName(name);
        playerName = name;
        hideNameModal();
        showToast("Name saved: " + name, "ok");
      } catch(e) {
        showToast("Error saving name: " + e.message, "warn");
      }
    };
  }

  // Enter key on name input
  const nameInput = $("nameInput");
  if (nameInput) {
    nameInput.onkeydown = (e) => {
      if (e.key === "Enter") $("saveNameBtn")?.click();
    };
  }
}

// Update wallet UI based on state
function updateWalletUI(state) {
  const btn = $("walletConnectBtn");
  const nameEl = $("walletName");

  if (!btn) return;

  // Loading state
  if (state.isLoading) {
    btn.textContent = "Loading...";
    btn.className = "btn";
    btn.disabled = true;
    if (nameEl) nameEl.style.display = "none";
    return;
  }

  btn.disabled = false;
  btn.className = "btn";

  if (state.isConnected) {
    if (nameEl) {
      nameEl.style.display = "inline";
      nameEl.textContent = state.playerName || Wallet.formatAddress(state.address);
    }
    btn.textContent = "Disconnect";
  } else {
    if (nameEl) nameEl.style.display = "none";
    btn.textContent = state.isMetaMaskInstalled ? "Connect" : "Install MetaMask";
  }
}

function showNameModal() {
  const modal = $("nameModal");
  const input = $("nameInput");
  if (modal) {
    modal.classList.remove("hidden");
    setTimeout(() => input?.focus(), 100);
  }
}

function hideNameModal() {
  const modal = $("nameModal");
  if (modal) modal.classList.add("hidden");
  const input = $("nameInput");
  if (input) input.value = "";
}