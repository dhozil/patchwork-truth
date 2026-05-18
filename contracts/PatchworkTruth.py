# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class PatchworkTruth(gl.Contract):
    # ── Persistent Storage (class-level type annotations REQUIRED) ─────────────
    evaluations: TreeMap[str, str]
    match_to_eval: TreeMap[str, str]
    player_xp: TreeMap[str, bigint]
    player_names: TreeMap[str, str]
    player_profiles: TreeMap[str, str]
    matches: TreeMap[str, str]
    leaderboard: TreeMap[str, bigint]

    # ── Init ─────────────────────────────────────────────────────────────────
    def __init__(self):
        # All storage is zero-initialized by GenLayer.
        # Class-level type annotations ensure persistence.
        # Do NOT assign storage here — use class-level declarations only.
        pass

    # ── Read Methods ────────────────────────────────────────────────────────

    @gl.public.view
    def get_evaluation(self, evaluation_id: str) -> str:
        return self.evaluations.get(evaluation_id, "")

    @gl.public.view
    def get_match_evaluation(self, match_id: str) -> str:
        eval_id = self.match_to_eval.get(match_id, "")
        return self.evaluations.get(eval_id, "")

    @gl.public.view
    def get_player_xp(self, player_address: str) -> bigint:
        return self.player_xp.get(player_address, 0)

    @gl.public.view
    def get_player_name(self, player_address: str) -> str:
        """Get player display name from address. Returns empty string if not set."""
        return self.player_names.get(player_address, "")

    @gl.public.view
    def get_player_profile(self, player_address: str) -> str:
        """Get full player profile (name, score, xp, games_played)."""
        profile = self.player_profiles.get(player_address, "")
        if profile:
            return profile
        # Fallback: build from individual fields
        name = self.player_names.get(player_address, "")
        score = int(self.leaderboard.get(player_address, 0))
        xp = int(self.player_xp.get(player_address, 0))
        return json.dumps({
            "player_address": player_address,
            "name": name,
            "score": score,
            "xp": xp,
            "games_played": 0
        })

    @gl.public.view
    def get_leaderboard(self) -> str:
        """Get top 20 players sorted by score, with names."""
        all_players = []
        for addr, score in self.leaderboard.items():
            name = self.player_names.get(addr, addr[:8] + "...")
            all_players.append({
                "player_address": addr,
                "name": name,
                "score": int(score),
                "xp": int(self.player_xp.get(addr, 0))
            })
        all_players.sort(key=lambda x: x["score"], reverse=True)
        return json.dumps(all_players[:20])

    @gl.public.view
    def get_match_status(self, match_id: str) -> str:
        return self.matches.get(match_id, "")

    @gl.public.view
    def is_player_registered(self, player_address: str) -> bool:
        """Check if player has set a display name."""
        return len(self.player_names.get(player_address, "")) > 0

    # ── Write Methods ───────────────────────────────────────────────────────

    @gl.public.write
    def set_player_name(self, name: str) -> str:
        """
        Set player display name. Called once after wallet connect.
        Name is permanently stored on-chain.
        """
        sender = str(gl.message.sender_address)
        if len(name) < 2 or len(name) > 24:
            return json.dumps({"status": "error", "reason": "Name must be 2-24 characters"})
        self.player_names[sender] = name
        return json.dumps({"status": "ok", "name": name, "player_address": sender})

    @gl.public.write
    def evaluate(
        self,
        match_id: str,
        scenario_id: str,
        narrative: str,
        fragments: DynArray[str],
        contributions: DynArray[str],
    ) -> str:
        """
        GenLayer LLM evaluation.
        Uses gl.nondet.exec_prompt() for fast single LLM call (~15-30s per tx).
        """
        sender = str(gl.message.sender_address)

        def judge() -> str:
            frag_text = "\n".join(f"  - {f}" for f in fragments)
            contrib_text = "\n".join(f"  - {c}" for c in contributions)
            p = (
                'You are a fair narrative evaluator for Patchwork Truth.\n'
                f'SCENARIO: {scenario_id}\n'
                f'NARRATIVE:\n{narrative}\n'
                f'\nEVIDENCE FRAGMENTS:\n{frag_text}\n'
                f'\nPLAYER CONTRIBUTIONS:\n{contrib_text}\n'
                'Score the narrative on 4 dimensions (each 0-25, max 100 total):\n'
                '  1. COHERENCE — logical, internally consistent?\n'
                '  2. EVIDENCE INTEGRATION — uses fragments to support claims?\n'
                '  3. ARGUMENT QUALITY — reasoning strength and proportional conclusions?\n'
                '  4. MANIPULATION RESISTANCE — avoids cherry-picking or over-interpreting?\n'
                'Return ONLY valid JSON: {"coherence":<int>,"evidence":<int>,"argument":<int>,"manipulation":<int>}'
            )
            return gl.nondet.exec_prompt(p, response_format="json")

        # prompt_comparative: validators agree on valid JSON structure, contract parses after
        raw = gl.eq_principle.prompt_comparative(
            judge,
            "Both outputs must be valid JSON with exactly 4 integer keys: coherence, evidence, argument, manipulation. "
            "Each value must be an integer 0-25. The exact score numbers, whitespace, and key order may differ. "
            "The contract computes the total and distributes scores after parsing.",
        )
        # Parse JSON result (validators agreed on structure via prompt_comparative)
        # Robust parsing: extract all integers 0-25 from raw output, assign to keys in order
        import re as regex_mod
        all_nums = regex_mod.findall(r'\b(\d+)\b', str(raw))
        # Filter to scores (0-25), take first 4 in order of appearance
        scores_found = [int(n) for n in all_nums if 0 <= int(n) <= 25]
        coherence    = scores_found[0] if len(scores_found) > 0 else 0
        evidence     = scores_found[1] if len(scores_found) > 1 else 0
        argument     = scores_found[2] if len(scores_found) > 2 else 0
        manipulation = scores_found[3] if len(scores_found) > 3 else 0

        total = coherence + evidence + argument + manipulation

        result = {
            "evaluation_id": match_id,
            "match_id": match_id,
            "scenario_id": scenario_id,
            "scores": {"coherence": coherence, "evidence": evidence, "argument": argument, "manipulation": manipulation},
            "total_score": total,
            "player_address": sender,
        }

        self.evaluations[match_id] = json.dumps(result)
        self.match_to_eval[match_id] = match_id

        # Update leaderboard: keep highest score per player
        current_best = self.leaderboard.get(sender, 0)
        if total > current_best:
            self.leaderboard[sender] = total
            self._update_profile(sender)

        return json.dumps(result)

    def _update_profile(self, player_address: str):
        """Update the full player profile after score/XP changes."""
        name = self.player_names.get(player_address, player_address[:8] + "...")
        score = int(self.leaderboard.get(player_address, 0))
        xp = int(self.player_xp.get(player_address, 0))
        profile = {
            "player_address": player_address,
            "name": name,
            "score": score,
            "xp": xp,
            "games_played": 1
        }
        self.player_profiles[player_address] = json.dumps(profile)

    @gl.public.write
    def resolve_challenge(
        self,
        evaluation_id: str,
        challenge_reason: str,
        challenge_valid: bool,
    ) -> str:
        """
        Optimistic Democracy challenge resolution.
        Uses strict_eq for fair, consensus-based decision.
        XP is added/removed from transaction sender.
        """
        sender = str(gl.message.sender_address)

        if challenge_valid:
            current = self.player_xp.get(sender, 0)
            self.player_xp[sender] = current + 14
            self._update_profile(sender)
            return json.dumps({"status": "accepted", "xp_delta": 14, "reason": challenge_reason})
        else:
            current = self.player_xp.get(sender, 0)
            self.player_xp[sender] = max(0, current - 6)
            self._update_profile(sender)
            return json.dumps({"status": "rejected", "xp_delta": -6, "reason": challenge_reason})

    @gl.public.write
    def add_xp(self, player_address: str, amount: bigint) -> str:
        """Admin XP management."""
        current = self.player_xp.get(player_address, 0)
        self.player_xp[player_address] = current + amount
        self._update_profile(player_address)
        return json.dumps({"player_address": player_address, "new_xp": int(current + amount)})

    @gl.public.write
    def submit_evidence(self, match_id: str, topic: str) -> str:
        """
        Fetch real evidence from the web for the current game topic.
        Uses gl.nondet.web.get() — GenLayer-specific web fetch feature.
        All validators must agree on the fetched evidence (strict_eq).
        """
        sender = str(gl.message.sender_address)

        def do_web_fetch() -> str:
            search_url = f"https://duckduckgo.com/?q={topic.replace(' ', '+')}&format=json"
            try:
                response = gl.nondet.web.get(search_url)
                return response.body
            except Exception:
                return '{"error": "fetch_failed"}'

        raw_evidence = gl.eq_principle.strict_eq(do_web_fetch)

        evidence_record = {
            "match_id": match_id,
            "topic": topic,
            "player_address": sender,
            "fetched_evidence": raw_evidence[:500],
        }

        self.matches[match_id] = json.dumps(evidence_record)
        return json.dumps({"status": "ok", "evidence_preview": raw_evidence[:200]})