/**
 * Patchwork Truth - Wallet Integration
 *
 * Follows Gotham Court pattern: browser calls genlayer-js directly.
 * MetaMask provides the signer account — no server-side signing needed.
 *
 * genlayer-js CDN exposes:
 *   window.genlayer.createClient({ chain, account })  → read/write contract
 *   window.genlayer.chains.studionet                  → GenLayer Studio network
 */

const STUDIONET_CHAIN_ID_HEX = "0xF22F";
const STUDIONET_CHAIN_ID = 61999;
const STUDIONET_RPC = "https://studio.genlayer.com/api";
const STUDIONET_NAME = "GenLayer Studio";
const CONTRACT_ADDRESS = "0x5700c8ce661A7A00780Bc1b99C046C424D284E5E";

const NATIVE_CURRENCY = { name: "GEN", symbol: "GEN", decimals: 18 };

// ── Wallet State ─────────────────────────────────────────────────────────────

const walletState = {
  address: null,
  chainId: null,
  isConnected: false,
  isLoading: false,
  isMetaMaskInstalled: false,
  isOnCorrectNetwork: false,
  playerName: null,
  playerRegistered: false,
  _client: null,
  _listeners: []
};

// ── GenLayer Client ───────────────────────────────────────────────────────────

function getGenLayer() {
  return window.genlayer || window.genlayer_js || null;
}

function createClient(address) {
  const gen = getGenLayer();
  if (!gen) throw new Error("genlayer-js not loaded. Check CDN script tag.");
  return gen.createClient({
    chain: gen.chains.studionet,
    account: address
  });
}

async function getClient() {
  if (!walletState._client || walletState._client.account?.address !== walletState.address) {
    if (!walletState.address) throw new Error("Wallet not connected");
    walletState._client = createClient(walletState.address);
  }
  return walletState._client;
}

// ── Event System ───────────────────────────────────────────────────────────────

function onWalletChange(callback) {
  walletState._listeners.push(callback);
  return () => {
    walletState._listeners = walletState._listeners.filter(cb => cb !== callback);
  };
}

function notifyWalletChange() {
  walletState._listeners.forEach(cb => cb({ ...walletState }));
}

// ── MetaMask Helpers ──────────────────────────────────────────────────────────

function getMetaMask() {
  return window.ethereum || window.ethers?.providers?.MetaMask || null;
}

// ── Connection ────────────────────────────────────────────────────────────────

async function connectWallet() {
  const eth = getMetaMask();
  if (!eth) throw new Error("MetaMask not found. Install the extension.");

  walletState.isLoading = true;
  walletState._pendingConnect = true;
  notifyWalletChange();

  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No accounts found");

    walletState.address = accounts[0];
    walletState.isConnected = true;

    // Switch to studionet if needed
    const chainIdHex = await eth.request({ method: "eth_chainId" });
    walletState.chainId = chainIdHex;
    walletState.isOnCorrectNetwork = chainIdHex?.toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase();

    if (!walletState.isOnCorrectNetwork) {
      await switchToStudionet();
    }

    // Create client with MetaMask account (MetaMask signs transactions)
    walletState._client = createClient(walletState.address);

    await loadPlayerName();

    walletState.isLoading = false;
    walletState._pendingConnect = false;
    notifyWalletChange();
    return walletState.address;
  } catch (err) {
    walletState.isLoading = false;
    walletState._pendingConnect = false;
    walletState.isConnected = false;
    walletState.address = null;
    notifyWalletChange();
    if (err.code === 4001) throw new Error("Connection rejected by user");
    throw err;
  }
}

async function disconnectWallet() {
  // Revoke permissions so MetaMask "forgets" this connection.
  // After revoke, eth_accounts returns [] and connect button shows "Connect" properly.
  const eth = getMetaMask();
  if (eth) {
    eth.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: null }] }).catch(() => {});
  }
  walletState.address = null;
  walletState.isConnected = false;
  walletState._client = null;
  walletState.playerName = null;
  walletState.playerRegistered = false;
  notifyWalletChange();
}

async function switchToStudionet() {
  const eth = getMetaMask();
  if (!eth) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }]
    });
    walletState.isOnCorrectNetwork = true;
  } catch (switchErr) {
    if (switchErr.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: STUDIONET_CHAIN_ID_HEX,
          chainName: STUDIONET_NAME,
          nativeCurrency: NATIVE_CURRENCY,
          rpcUrls: [STUDIONET_RPC],
          blockExplorerUrls: ["https://studio.genlayer.com/explorer"]
        }]
      });
      walletState.isOnCorrectNetwork = true;
    }
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initWallet() {
  const eth = getMetaMask();
  walletState.isMetaMaskInstalled = !!eth;

  if (!eth) {
    notifyWalletChange();
    return;
  }

  const savedName = localStorage.getItem("pt_playerName");
  if (savedName) {
    walletState.playerName = savedName;
    walletState.playerRegistered = true;
  }

  eth.request({ method: "eth_accounts" }).then(accounts => {
    if (accounts?.length > 0) {
      walletState.address = accounts[0];
      walletState.isConnected = true;
      notifyWalletChange();

      eth.request({ method: "eth_chainId" }).then(chainId => {
        walletState.chainId = chainId;
        walletState.isOnCorrectNetwork = chainId?.toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase();
        walletState._client = createClient(walletState.address);
        loadPlayerName();
      }).catch(() => {
        walletState._client = createClient(walletState.address);
        loadPlayerName();
      });
    } else {
      notifyWalletChange();
    }
  }).catch(() => notifyWalletChange());
}

// Promise-based init — use when you need to wait for wallet to finish loading
function initWalletAsync() {
  return new Promise((resolve) => {
    const eth = getMetaMask();
    walletState.isMetaMaskInstalled = !!eth;

    if (!eth) {
      notifyWalletChange();
      resolve();
      return;
    }

    const savedName = localStorage.getItem("pt_playerName");
    if (savedName) {
      walletState.playerName = savedName;
      walletState.playerRegistered = true;
    }

    eth.request({ method: "eth_accounts" }).then(accounts => {
      if (accounts?.length > 0) {
        walletState.address = accounts[0];
        walletState.isConnected = true;
        notifyWalletChange();
      } else {
        notifyWalletChange();
      }
      resolve();
    }).catch(() => {
      notifyWalletChange();
      resolve();
    });
  });
}

// Event listeners (outside init so they register immediately when wallet.js loads)
(function () {
  const eth = getMetaMask();
  if (!eth) return;
  eth.on("accountsChanged", (accounts) => {
    // This fires when: user disconnects from MetaMask extension, switches accounts, or locks
    console.log("[Wallet] accountsChanged:", accounts);
    if (!accounts?.length) {
      walletState.address = null;
      walletState.isConnected = false;
      walletState._client = null;
      walletState.playerName = null;
      walletState.playerRegistered = false;
      notifyWalletChange();
    } else {
      walletState.address = accounts[0];
      walletState.isConnected = true;
      notifyWalletChange();
      walletState._client = createClient(walletState.address);
      loadPlayerName();
    }
  });
  eth.on("chainChanged", (chainId) => {
    walletState.chainId = chainId;
    walletState.isOnCorrectNetwork = chainId?.toLowerCase() === STUDIONET_CHAIN_ID_HEX.toLowerCase();
    notifyWalletChange();
  });
})();

// ── Contract Read/Write ────────────────────────────────────────────────────────

/**
 * Read from contract using genlayer-js client (MetaMask signs reads too on GenLayer).
 * Uses: client.readContract({ address, functionName, args })
 */
async function readContract(functionName, args = []) {
  const client = await getClient();
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args
  });
  return mapContractResult(result);
}

/**
 * Poll a contract read until it returns a non-empty result.
 * GenLayer async execution means TreeMap data may not be immediately available
 * after a write tx is accepted — this polls until ready (max ~120s).
 */
async function pollReadUntilResult(functionName, args, maxAttempts = 24, intervalMs = 5000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await readContract(functionName, args);
      const str = typeof raw === "string" ? raw.trim() : JSON.stringify(raw || "");
      const isEmpty = !str || str === "null" || str === "undefined" || str === "{}" || str === "";
      if (!isEmpty) {
        console.log(`[Wallet] pollRead hit ${functionName} at attempt ${attempt}`);
        // If it's a JSON string, parse it
        if (typeof raw === "string") {
          try { return JSON.parse(raw); } catch (_) {}
        }
        return raw;
      }
      console.log(`[Wallet] pollRead ${attempt}/${maxAttempts}: empty for ${functionName}, retrying...`);
    } catch (e) {
      // Transient error — continue polling
      console.warn(`[Wallet] pollRead error on attempt ${attempt}: ${e.message}`);
    }
    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
  console.warn(`[Wallet] pollRead: max attempts reached for ${functionName}`);
  return null;
}

/**
 * Write to contract. MetaMask automatically prompts for signature.
 * Uses: client.writeContract(...) then waitForTransactionReceipt(..., status: "ACCEPTED")
 */
async function writeContract(functionName, args = []) {
  const client = await getClient();
  console.log(`[Wallet] writeContract: ${functionName}(${JSON.stringify(args).substring(0, 100)})`);

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value: BigInt(0)
  });
  console.log(`[Wallet] TX submitted: ${txHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: "ACCEPTED",
    retries: 12,
    interval: 5000
  });
  console.log(`[Wallet] TX confirmed: ${receipt?.transactionHash}, status: ${receipt?.status}`);
  return receipt;
}

// ── Player Name ────────────────────────────────────────────────────────────────

async function loadPlayerName() {
  if (!walletState.address) return null;

  // localStorage first (always available after first save)
  const savedName = localStorage.getItem("pt_playerName");
  if (savedName) {
    walletState.playerName = savedName;
    walletState.playerRegistered = true;
    notifyWalletChange();
    return savedName;
  }

  // On-chain read using player's own address (key in player_names TreeMap)
  try {
    const name = await readContract("get_player_name", [walletState.address]);
    if (name && typeof name === "string" && name.length > 0) {
      walletState.playerName = name;
      walletState.playerRegistered = true;
      localStorage.setItem("pt_playerName", name);
      console.log(`[Wallet] Name loaded from contract: "${name}"`);
      notifyWalletChange();
      return name;
    }
  } catch (e) {
    console.warn(`[Wallet] loadPlayerName error: ${e.message}`);
  }
  walletState.playerName = null;
  walletState.playerRegistered = false;
  notifyWalletChange();
  return null;
}

async function savePlayerName(name) {
  if (!walletState.isConnected) throw new Error("Wallet not connected");

  localStorage.setItem("pt_playerName", name);
  walletState.playerName = name;
  walletState.playerRegistered = true;
  notifyWalletChange();

  // On-chain write — MetaMask prompts user to sign
  await writeContract("set_player_name", [name]);
  console.log(`[Wallet] Name saved on-chain: "${name}"`);
  return name;
}

// ── Game Contract Calls ────────────────────────────────────────────────────────

/**
 * Submit narrative for AI Consensus evaluation via GenLayer.
 * Calls: evaluate(match_id, scenario_id, narrative, fragments[], contributions[])
 * Contract runs: gl.nondet.exec_prompt() → LLM evaluates narrative
 *                 gl.eq_principle.strict_eq() → all validators agree on score
 *
 * Returns: { scores: {coherence, evidence, argument, manipulation}, total_score }
 * (Python contract uses snake_case; normalized to camelCase before returning).
 */
async function evaluateNarrative(matchId, scenarioId, narrative, fragments, contributions) {
  console.log(`[Wallet] evaluateNarrative: match=${matchId}, scenario=${scenarioId}, narrative=${narrative.substring(0,60)}...`);
  const receipt = await writeContract("evaluate", [
    matchId,
    scenarioId,
    narrative,
    fragments || [],
    contributions || []
  ]);
  // After tx accepted, poll get_match_evaluation() until GenLayer computation is done.
  // GenLayer LLM call (gl.nondet.exec_prompt + strict_eq) takes 30–90s — poll up to 2 min.
  let result = await pollReadUntilResult("get_match_evaluation", [matchId], 24, 5000);

  // Fallback: if poll returned null/empty, try a direct read (may succeed after tx finality)
  if (!result) {
    console.warn(`[Wallet] pollRead returned empty — trying direct read as fallback`);
    try {
      result = await readContract("get_match_evaluation", [matchId]);
      console.log(`[Wallet] Direct read result:`, result);
    } catch (e) {
      console.warn(`[Wallet] Direct read failed: ${e.message}`);
    }
  }

  // Normalize snake_case from Python contract → camelCase
  if (result && typeof result === "object") {
    // Python contract returns {scores: {...}, total_score: N}
    // Ensure camelCase totalScore is present alongside snake_case total_score
    if (result.total_score !== undefined && result.totalScore === undefined) {
      result.totalScore = typeof result.total_score === "object"
        ? Number(result.total_score?.value ?? result.total_score)
        : Number(result.total_score);
    }
    // Normalize scores sub-object
    if (result.scores && typeof result.scores === "object") {
      const s = result.scores;
      // snake_case keys from Python contract
      if ((s.evidence !== undefined || s.total_score !== undefined) && s.evidenceIntegration === undefined) {
        result.scores.evidenceIntegration  = s.evidenceIntegration  || s.evidence  || 0;
        result.scores.argumentQuality      = s.argumentQuality      || s.argument  || 0;
        result.scores.manipulationResistance = s.manipulationResistance || s.manipulation || 0;
      }
    }
    console.log(`[Wallet] AI Consensus result (normalized):`, result);
    return result;
  }

  console.log(`[Wallet] AI Consensus result:`, result);
  return result;
}

/**
 * Fetch real evidence from the web via GenLayer.
 * Calls: submit_evidence(match_id, topic)
 * Contract runs: gl.nondet.web.get(url) → fetch evidence
 *                gl.eq_principle.strict_eq() → all validators agree on fetched content
 *
 * Returns: { match_id, topic, fetched_evidence }
 */
async function submitEvidence(matchId, topic) {
  console.log(`[Wallet] submitEvidence: match=${matchId}, topic="${topic}"`);
  const receipt = await writeContract("submit_evidence", [matchId, topic]);
  const result = await readContract("get_match_status", [matchId]);
  console.log(`[Wallet] Web fetch result:`, result);
  return result;
}

/**
 * Challenge an evaluation. GenLayer AI consensus decides validity.
 * Calls: resolve_challenge(evaluation_id, challenge_reason, challenge_valid)
 * Contract runs: strict_eq → validator consensus on challenge validity
 * XP updated on-chain: +14 if valid, -6 if rejected
 */
async function resolveChallenge(evaluationId, challengeReason, challengeValid) {
  console.log(`[Wallet] resolveChallenge: eval=${evaluationId}, valid=${challengeValid}`);
  return writeContract("resolve_challenge", [evaluationId, challengeReason, challengeValid]);
}

/**
 * Get on-chain leaderboard (top 20 players from TreeMap).
 * Calls: get_leaderboard() → returns JSON array of {name, score, xp}
 */
async function getLeaderboard() {
  const data = await readContract("get_leaderboard", []);
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return []; }
  }
  return data || [];
}

/**
 * Get player profile from on-chain storage.
 * Calls: get_player_profile(address) → returns JSON {name, score, xp, games_played}
 */
async function getPlayerProfile(address) {
  const data = await readContract("get_player_profile", [address || walletState.address]);
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return null; }
  }
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapContractResult(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    if (val.type === "BigInt" || val.type === "bigint") return Number(val);
    if (val.value !== undefined) return val.value;
    if (val.inner !== undefined) return val.inner;
  }
  // If result is a JSON string (GenLayer returns stringified structs), parse it
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch (_) {}
  }
  // Recursively normalize any BigInt-wrapped fields (GenLayer structs deserialize
  // as {type:"BigInt", value:"123"} objects via ethers.js — convert to plain numbers).
  if (typeof val === "object" && val !== null) {
    const normalized = {};
    for (const [k, v] of Object.entries(val)) {
      if (v && typeof v === "object" && (v.type === "BigInt" || v.type === "bigint")) {
        normalized[k] = Number(v.value ?? v);
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        normalized[k] = mapContractResult(v);
      } else {
        normalized[k] = v;
      }
    }
    return normalized;
  }
  return val;
}

function formatAddress(address, short = true) {
  if (!address) return "";
  if (short) return address.slice(0, 6) + "..." + address.slice(-4);
  return address;
}

function isValidAddress(address) {
  return address && address.startsWith("0x") && address.length === 42;
}

// ── Export ─────────────────────────────────────────────────────────────────────

window.Wallet = {
  // State
  getState: () => ({ ...walletState }),
  onChange: onWalletChange,

  // Connection
  connect: connectWallet,
  disconnect: disconnectWallet,

  // Chain
  switchToStudionet,

  // Contract reads
  read: readContract,
  getLeaderboard,
  getPlayerProfile,

  // Contract writes
  write: writeContract,
  savePlayerName,
  evaluateNarrative,
  submitEvidence,
  resolveChallenge,

  // Player name
  loadPlayerName,

  // Utils
  formatAddress,
  isValidAddress,

  // Init
  init: initWalletAsync,

  // Constants
  CONTRACT_ADDRESS
};