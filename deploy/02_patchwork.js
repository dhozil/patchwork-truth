/**
 * deploy/02_patchwork.js
 * Deployment script for PatchworkTruth contracts.
 * Run AFTER genlayer CLI is authenticated and network is selected.
 *
 * Usage:
 *   npx genlayer deploy deploy/02_patchwork.js
 *
 * Or if using the CLI:
 *   genlayer deploy contracts/PatchworkTruth.sol
 */

const { genlayer } = require('genlayer');

async function main() {
  console.log("Deploying PatchworkTruth contract...");

  // Check network
  const network = await genlayer.getNetwork();
  console.log("Network:", network);

  // Deploy the contract
  const contract = await genlayer.deploy(
    'PatchworkTruth',
    './contracts/PatchworkTruth.py'
  );

  console.log("Contract deployed at:", contract.address);

  // Register default scenarios
  const scenarios = [
    {
      id: 'mystery',
      label: 'Mystery Investigation',
      color: '#00e5ff',
      prompt: 'Investigate a mysterious incident using conflicting evidence fragments.',
      guide_contribution: 'Make one specific, evidence-based claim. Cite the fragment ID you are relying on.',
      guide_narrative: 'Summarize the strongest evidence into 1-2 sentences. Acknowledge uncertain parts.'
    },
    {
      id: 'scifi',
      label: 'Space Crisis',
      color: '#b388ff',
      prompt: 'Uncover what caused the critical system failure on the space station.',
      guide_contribution: 'Make one claim backed by sensor data or crew reports.',
      guide_narrative: 'Build a coherent timeline from the conflicting sensor readings.'
    },
    {
      id: 'politics',
      label: 'Contract Dispute',
      color: '#69f0ae',
      prompt: 'Resolve a legal conflict using contradictory contract clauses and communications.',
      guide_contribution: 'Cite the specific clause or document supporting your interpretation.',
      guide_narrative: 'Apply the strongest interpretation principle, acknowledge ambiguity.'
    },
    {
      id: 'conspiracy',
      label: 'Conspiracy Theory',
      color: '#ffd740',
      prompt: 'Separate verified facts from speculation in a viral social media event.',
      guide_contribution: 'Distinguish between verified claims and unverified allegations.',
      guide_narrative: 'Weave together only verified facts, clearly labeling speculation.'
    },
    {
      id: 'heist',
      label: 'Art Heist',
      color: '#ff80ab',
      prompt: 'Reconstruct the art heist from fragmented CCTV, logs, and witness reports.',
      guide_contribution: 'Anchor your claim in a specific piece of physical evidence.',
      guide_narrative: 'Identify the most plausible sequence of events with evidence.'
    },
    {
      id: 'corporate',
      label: 'Corporate Scandal',
      color: '#8c9eff',
      prompt: 'Investigate a suspicious wire transfer and company restructuring.',
      guide_contribution: 'Distinguish between suspicious patterns and authorized actions.',
      guide_narrative: 'Weave the financial and HR data into a coherent narrative.'
    },
    {
      id: 'historical',
      label: 'Historical Mystery',
      color: '#bcaaa4',
      prompt: 'Understand the events leading to a pivotal historical surrender.',
      guide_contribution: 'Ground your claim in the primary source documents.',
      guide_narrative: 'Distinguish between immediate triggers and long-term causes.'
    },
    {
      id: 'survival',
      label: 'Survival Mystery',
      color: '#80cbc4',
      prompt: 'Piece together conflicting accounts of a wilderness survival incident.',
      guide_contribution: 'Cross-reference personal accounts with physical/logistical evidence.',
      guide_narrative: 'Identify what the physical evidence tells us independent of testimony.'
    }
  ];

  for (const s of scenarios) {
    await contract.register_scenario(s.id, s.label, s.color, s.prompt, s.guide_contribution, s.guide_narrative);
    console.log(`  Registered scenario: ${s.id}`);
  }

  console.log("\nDeployment complete!");
  console.log("Contract address:", contract.address);
  console.log("\nCopy this address to your .env:");
  console.log(`  NEXT_PUBLIC_CONTRACT_ADDRESS=${contract.address}`);
}

main().catch(console.error);
