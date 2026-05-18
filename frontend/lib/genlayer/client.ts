/**
 * frontend/lib/genlayer/client.ts
 * GenLayer client for Patchwork Truth
 * Handles wallet connection and contract interactions.
 */

import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { mainnet } from 'viem/chains';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

export interface EvaluationResult {
  evaluation_id: string;
  narrative: string;
  scores: {
    coherence: number;
    evidence: number;
    argument: number;
    manipulation: number;
  };
  total_score: number;
  evaluator: string;
  timestamp: string;
}

export interface ContractConfig {
  address: string;
  network: 'studionet' | 'testnet' | 'localnet';
}

/**
 * Initialize the GenLayer contract client.
 * Returns null if no contract is deployed yet.
 */
export function getContractClient(config?: ContractConfig): ContractClient | null {
  if (!CONTRACT_ADDRESS && !config?.address) return null;
  const address = config?.address || CONTRACT_ADDRESS;
  if (!address || address.startsWith('0x0000')) return null;
  return new ContractClient(address, config?.network || 'studionet');
}

export class ContractClient {
  address: string;
  network: string;

  constructor(address: string, network: 'studionet' | 'testnet' | 'localnet' = 'studionet') {
    this.address = address;
    this.network = network;
  }

  /**
   * Call the `evaluate` method on PatchworkTruth contract.
   * Returns the total score (0-100).
   */
  async evaluate(params: {
    matchId: string;
    scenarioId: string;
    narrative: string;
    fragments: string[];
    contributions: string[];
    playerWallet: string;
  }): Promise<number> {
    const calldata = {
      functionName: 'evaluate',
      args: {
        match_id: params.matchId,
        scenario_id: params.scenarioId,
        narrative: params.narrative,
        fragments: params.fragments,
        contributions: params.contributions,
        player_wallet: params.playerWallet
      }
    };
    // This would use viem's contract call
    // For now, returns a placeholder — wire up via genlayer SDK when contract is deployed
    console.log('[ContractClient] evaluate:', calldata);
    return 0; // replaced by actual contract call
  }

  /**
   * Resolve a challenge via the contract.
   */
  async resolveChallenge(params: {
    evaluationId: string;
    challengeReason: string;
    challengeValid: boolean;
    playerWallet: string;
    challengeDeposit: number;
  }): Promise<{ status: string; bonus_xp?: number; penalty_xp?: number }> {
    const calldata = {
      functionName: 'resolve_challenge',
      args: params
    };
    console.log('[ContractClient] resolveChallenge:', calldata);
    return { status: 'pending' }; // replaced by actual contract call
  }

  /**
   * Get evaluation result for a match.
   */
  async getMatchEvaluation(matchId: string): Promise<EvaluationResult | null> {
    console.log('[ContractClient] getMatchEvaluation:', matchId);
    return null; // replaced by actual contract call
  }

  /**
   * Get accumulated XP for a player wallet.
   */
  async getPlayerXP(wallet: string): Promise<number> {
    console.log('[ContractClient] getPlayerXP:', wallet);
    return 0;
  }
}

/**
 * Wallet connection helpers.
 */
export async function connectWallet(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.ethereum) {
    alert('Please install MetaMask or a Web3 wallet to connect.');
    return null;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0] || null;
  } catch (err) {
    console.error('Wallet connection failed:', err);
    return null;
  }
}

export function formatAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function isConnected(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<string[]>;
      on(event: string, handler: (...args: unknown[]) => void): void;
    };
  }
}