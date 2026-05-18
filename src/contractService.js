/**
 * Patchwork Truth - Server-Side Contract Service
 * Uses genlayer-js to interact with the deployed contract on Studionet
 */

const { createClient, chains } = require("genlayer-js");
const { privateKeyToAccount } = require("viem/accounts");

const studionet = chains.studionet;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5700c8ce661A7A00780Bc1b99C046C424D284E5E";
const ENABLE_CONTRACT = process.env.ENABLE_CONTRACT === "true";

// ── Client ─────────────────────────────────────────────────────────────────────

// Read-only client (no signer needed)
const publicClient = createClient({
  chain: studionet
});

// ── Contract ABI ──────────────────────────────────────────────────────────────

// Minimal ABI for the contract methods we use
const CONTRACT_ABI = [
  // View methods
  "function get_player_name(address player_address) view returns (string)",
  "function get_player_xp(address player_address) view returns (uint256)",
  "function get_leaderboard() view returns (string)",
  "function get_player_profile(address player_address) view returns (string)",
  "function is_player_registered(address player_address) view returns (bool)",
  "function get_evaluation(string evaluation_id) view returns (string)",
  "function get_match_evaluation(string match_id) view returns (string)",
  // Write methods
  "function set_player_name(string name) returns (string)",
  "function evaluate(string match_id, string scenario_id, string narrative, string[] fragments, string[] contributions) returns (string)",
  "function resolve_challenge(string evaluation_id, string challenge_reason, bool challenge_valid) returns (string)",
  "function add_xp(address player_address, uint256 amount) returns (string)",
  "function submit_evidence(string match_id, string topic) returns (string)"
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapContractResult(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    if (val.type === "BigInt" || val.type === "bigint") {
      return Number(val);
    }
    if (val.value !== undefined) {
      return val.value;
    }
    if (val.inner !== undefined) {
      return val.inner;
    }
  }
  // Handle JSON string from GenLayer contract (returns serialized string)
  if (typeof val === "string") {
    try { return JSON.parse(val); } catch (_) {}
    return val;
  }
  return val;
}

/**
 * Poll a contract read until it returns a non-empty result.
 * GenLayer async execution means TreeMap data may not be immediately available
 * after a write tx is accepted — this polls until ready (max ~120s).
 * Uses exponential backoff to avoid rate limit (429) errors.
 */
async function pollUntilResult(method, args, maxAttempts = 40, baseIntervalMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args: args
      });
      const mapped = mapContractResult(result);
      // Handle both raw string and wrapped result objects
      const str = typeof mapped === "string" ? mapped : JSON.stringify(mapped || "");
      const isEmpty = !str || str === "null" || str === "undefined" || str === "{}" || str.trim() === "";
      if (!isEmpty) {
        console.log(`[ContractService] Poll hit on attempt ${attempt}: ${method}`);
        return mapped;
      }
      console.log(`[ContractService] Poll ${attempt}/${maxAttempts}: empty result for ${method}, retrying...`);
    } catch (e) {
      // 429 = rate limited — wait longer before retry
      if (e?.response?.status === 429 || e?.message?.includes("429")) {
        const backoffMs = baseIntervalMs * 4;
        console.warn(`[ContractService] Rate limited (429), backing off ${backoffMs}ms...`);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }
      console.warn(`[ContractService] Poll attempt ${attempt} error:`, e.message);
    }
    if (attempt < maxAttempts) {
      // Linear backoff: 3s, 4.5s, 6s... capped at 15s
      const waitMs = Math.min(baseIntervalMs * (1 + attempt * 0.5), 15000);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  console.warn(`[ContractService] Poll exhausted for ${method} — returning empty`);
  return null;
}

// ── Mock Data (for development) ─────────────────────────────────────────────

const mockPlayerNames = new Map();
const mockLeaderboard = [];

// ── Read Methods ─────────────────────────────────────────────────────────────

async function contractRead(method, args = []) {
  if (!ENABLE_CONTRACT) {
    return mockContractRead(method, args);
  }

  try {
    const result = await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: method,
      args: args
    });
    return mapContractResult(result);
  } catch (err) {
    if (err.message?.includes("fetch failed")) {
      throw new Error(`GenLayer RPC unreachable. Check network connectivity.`);
    }
    if (err.message?.includes("NoneType") || err.message?.includes("AttributeError")) {
      return mockContractRead(method, args);
    }
    console.error(`[ContractService] Read error (${method}):`, err.message);
    throw err;
  }
}

function mockContractRead(method, args) {
  switch (method) {
    case "get_player_name":
      return mockPlayerNames.get(args[0]) || "";
    case "get_leaderboard":
      return JSON.stringify(mockLeaderboard);
    case "get_player_profile":
      const name = mockPlayerNames.get(args[0]) || "";
      return JSON.stringify({
        player_address: args[0],
        name,
        score: 0,
        xp: 0,
        games_played: 0
      });
    case "is_player_registered":
      return mockPlayerNames.has(args[0]);
    default:
      return null;
  }
}

// ── Write Methods ─────────────────────────────────────────────────────────────

let writeClient = null;
let walletAccount = null;
let serverWalletAddress = null; // server's wallet address — used for contract reads after writes

/**
 * Initialize write client with a signer account.
 * Uses PRIVATE_KEY env var, or generates an in-memory account.
 * Only initializes if ENABLE_CONTRACT=true.
 */
async function initWriteClient(privateKey) {
  if (!ENABLE_CONTRACT) {
    console.log("[ContractService] ENABLE_CONTRACT=false — skipping write client init");
    return null;
  }

  const { generatePrivateKey } = require("genlayer-js");
  let key = privateKey || process.env.PRIVATE_KEY;

  if (!key) {
    // Generate a fresh account (ephemeral — use for dev only)
    console.warn("[ContractService] No PRIVATE_KEY set — using ephemeral account. Writes will fail without funds.");
    key = generatePrivateKey();
  }

  // Use viem's privateKeyToAccount to derive correct address
  const account = privateKeyToAccount(key);

  writeClient = createClient({
    chain: studionet,
    account: account
  });

  const addr = writeClient.account.address;
  serverWalletAddress = addr;
  console.log(`[ContractService] Write client initialized for address: ${addr}`);
  return addr;
}

/**
 * Write to contract. Requires initWriteClient() to be called first.
 * Uses mock if ENABLE_CONTRACT=false.
 *
 * GenLayer contract functions return values that are stored in TreeMaps.
 * After a successful write, we re-read the relevant stored value so callers
 * get the actual contract return value (not just the tx receipt).
 *
 * @param {string} method — contract method name
 * @param {Array}  args  — positional args to the contract method
 * @param {number} [retries=36] — confirm retries
 * @param {string} [senderAddress] — player's wallet address (for read-back lookups after set_player_name)
 */
async function contractWrite(method, args = [], retries = 36, senderAddress) {
  if (!ENABLE_CONTRACT) {
    console.log(`[ContractService] Mock write: ${method}(${JSON.stringify(args)})`);
    return { status: "ok", mock: true, method, args };
  }

  if (!writeClient) {
    throw new Error("Write client not initialized. Call initWriteClient() first.");
  }

  try {
    const startTime = Date.now();
    console.log(`[ContractService] Writing to contract: ${method}(${JSON.stringify(args)})`);
    console.log(`[ContractService] Contract address: ${CONTRACT_ADDRESS}`);

    const txHash = await writeClient.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: method,
      args: args,
      value: BigInt(0)
    });
    console.log(`[ContractService] TX submitted: ${txHash} (${Date.now() - startTime}ms)`);

    console.log(`[ContractService] Waiting for tx confirmation (up to ${retries} retries × 5s = ${retries * 5}s max)...`);
    const receipt = await writeClient.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED",
      retries,
      interval: 5000
    });
    console.log(`[ContractService] TX confirmed after ${Date.now() - startTime}ms — status: ${receipt?.status}`);

    const statusCode = receipt?.status;
    if (statusCode !== undefined && statusCode !== 5 && statusCode !== 7) {
      throw new Error(`Transaction failed (status: ${statusCode})`);
    }

    // For evaluate(): GenLayer AI consensus computation happens DURING the tx execution.
    // The LLM call (gl.nondet.exec_prompt + strict_eq) runs on validators and takes 30-90s.
    // After tx is accepted, we poll the TreeMap for the result.
    let result = { transactionHash: receipt.transactionHash };

    // ── Per-method read-back: poll until the TreeMap has the result ───────────
    try {
      let readResult = null;
      if (method === "set_player_name") {
        const addr = senderAddress || Object.keys(mockPlayerNames).pop() || serverWalletAddress;
        console.log(`[ContractService] Re-reading player name for: ${addr}`);
        readResult = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_player_name",
          args: [addr]
        });
        console.log(`[ContractService] get_player_name = "${readResult}"`);
      } else if (method === "evaluate") {
        const matchId = args[0];
        console.log(`[ContractService] === GenLayer AI EVALUATION ===`);
        console.log(`[ContractService] Match ID: ${matchId}`);
        console.log(`[ContractService] Narrative: ${(args[2] || "").substring(0, 80)}...`);
        console.log(`[ContractService] Fragments: ${(args[3] || []).length} items`);
        console.log(`[ContractService] GenLayer is computing AI consensus (strict_eq)...`);
        console.log(`[ContractService] Polling get_match_evaluation() until result is ready...`);
        readResult = await pollUntilResult("get_match_evaluation", [matchId], 40, 3000);
        console.log(`[ContractService] === EVALUATION COMPLETE ===`);
        console.log(`[ContractService] Result: ${typeof readResult === "string" ? readResult.substring(0, 200) : JSON.stringify(readResult)}`);
      } else if (method === "resolve_challenge") {
        console.log(`[ContractService] resolve_challenge completed: ${receipt.transactionHash}`);
      }

      if (readResult !== null && readResult !== undefined) {
        let parsed = readResult;
        if (typeof readResult === "string" && method !== "set_player_name") {
          try { parsed = JSON.parse(readResult); } catch(e) { /* keep as string */ }
        }
        if (typeof parsed === "object" && parsed !== null) {
          result = { ...parsed, transactionHash: receipt.transactionHash };
        } else {
          result = { value: parsed, transactionHash: receipt.transactionHash };
        }
      }
    } catch (readErr) {
      console.warn(`[ContractService] Read-back error: ${readErr.message}`);
    }

    console.log(`[ContractService] Total time: ${Date.now() - startTime}ms`);
    return result;
  } catch (err) {
    console.error(`[ContractService] FATAL: ${method} failed — ${err.message}`);
    if (err.message?.includes("fetch failed")) {
      throw new Error(`GenLayer RPC unreachable. Check network connectivity.`);
    }
    throw err;
  }
}

// ── Convenience Methods ───────────────────────────────────────────────────────

async function getPlayerName(address) {
  return contractRead("get_player_name", [address]);
}

async function setPlayerName(name, senderAddress) {
  // Always update local mock data for UI consistency
  mockPlayerNames.set(senderAddress, name);

  if (!ENABLE_CONTRACT) {
    return { status: "ok", mock: true };
  }

  // Real on-chain write — senderAddress is the player's wallet address (the tx signer)
  try {
    return await contractWrite("set_player_name", [name], 36, senderAddress);
  } catch (err) {
    console.error(`[ContractService] On-chain write FAILED: ${err.message}, falling back to mock`);
    return { status: "ok", mock: true, error: err.message };
  }
}

async function getLeaderboard() {
  if (!ENABLE_CONTRACT) {
    return mockLeaderboard;
  }
  const data = await contractRead("get_leaderboard");
  if (data) {
    try {
      return typeof data === "string" ? JSON.parse(data) : data;
    } catch {
      return data;
    }
  }
  return [];
}

async function getPlayerProfile(address) {
  return contractRead("get_player_profile", [address]);
}

async function evaluateMatch(matchId, scenarioId, narrative, fragments, contributions, senderAddress) {
  console.log(`[ContractService] evaluateMatch()`);
  console.log(`  matchId:      ${matchId}`);
  console.log(`  scenarioId:   ${scenarioId}`);
  console.log(`  narrative:    ${(narrative || "").substring(0, 60)}...`);
  console.log(`  fragments:    ${(fragments || []).length} items`);
  console.log(`  contributions:${(contributions || []).length} items`);
  console.log(`  sender:       ${senderAddress}`);
  console.log(`  ENABLE_CONTRACT=${ENABLE_CONTRACT}`);
  return contractWrite("evaluate", [matchId, scenarioId, narrative, fragments || [], contributions || []]);
}

async function resolveChallenge(evaluationId, challengeReason, challengeValid, senderAddress) {
  console.log(`[ContractService] resolve_challenge("${evaluationId}", valid=${challengeValid}) by ${senderAddress}`);
  return contractWrite("resolve_challenge", [evaluationId, challengeReason, challengeValid]);
}

async function isPlayerRegistered(address) {
  return contractRead("is_player_registered", [address]);
}

/**
 * Fetch real evidence from the web using GenLayer's gl.nondet.web.get().
 * All validators must agree on the fetched evidence (strict_eq).
 * The evidence is stored on-chain in the matches TreeMap.
 *
 * @param {string} matchId  — unique ID for this evidence fetch
 * @param {string} topic   — search topic (e.g. "facility incident investigation evidence")
 * @returns {object}       — { status, evidence_preview, fetched_evidence }
 */
async function submitEvidence(matchId, topic) {
  console.log(`[ContractService] submitEvidence("${matchId}", topic: "${topic}")`);
  if (!ENABLE_CONTRACT) {
    // Fallback: generate mock evidence for development
    return {
      status: "ok",
      mock: true,
      matchId,
      topic,
      evidence_preview: `[Mock evidence for: ${topic}] Witness testimony indicates timeline discrepancy of approximately 7 minutes between sensor logs and official records. Access card logs show anomalies consistent with unauthorized entry.`,
      fetched_evidence: `[Mock evidence — ENABLE_CONTRACT=true to use real GenLayer web fetch]`
    };
  }
  try {
    const result = await contractWrite("submit_evidence", [matchId, topic]);
    console.log(`[ContractService] submitEvidence result:`, result);
    return result;
  } catch (err) {
    console.error(`[ContractService] submitEvidence failed:`, err.message);
    throw err;
  }
}

// ── Export ─────────────────────────────────────────────────────────────────────

module.exports = {
  initWriteClient,
  contractRead,
  contractWrite,
  getPlayerName,
  setPlayerName,
  getLeaderboard,
  getPlayerProfile,
  evaluateMatch,
  resolveChallenge,
  isPlayerRegistered,
  submitEvidence,
  CONTRACT_ADDRESS
};
