// examples.js — Rich example bank per scenario for Fill Example buttons
// Used by main.js to auto-fill contribution and narrative textareas

const EXAMPLES = {
  mystery: {
    contrib: [
      "The 19:07 signal spike at the main sensor is the most verifiable timeline anchor — the 340% spike cannot be an artefact, it is purely a physical anomaly.",
      "Systematically dead cameras for 40 seconds are unlikely a normal glitch — this pattern is consistent with deliberate sabotage before the incident.",
      "Maintenance ticket #4471 dated 2 days prior shows a fault in circuit breaker zone C — a direct antecedent to the thermal spike.",
      "Manager access card used at 18:58 while on leave — strong indicator of insider involvement.",
      "Second anonymous report cites maintenance ticket #4471 as key — unverified, but convergent with physical maintenance logs."
    ],
    narrative: [
      "The strongest evidence points to planned sabotage: thermal spike + camera blackout + access log anomaly occurred within a <15-minute window. However the anonymous report must be treated as unverified and cannot be the basis for a main claim.",
      "Most coherent chronology: fault circuit breaker zone C (2 days prior) → remote override 18:45 → access log anomaly 18:58 → thermal spike 19:04 → thud 19:05 → camera blackout 19:07. Uncertainty: anonymous report, network log external IP.",
      "Incident likely a combination of fault + opportunity: maintenance ticket shows known vulnerability, remote override is a suspicious antecedent. Deliberate sabotage claim cannot be confirmed without evidence from the network log external IP."
    ]
  },
  scifi: {
    contrib: [
      "Telemetry prime shows 'NOMINAL' while pressure sensor dropped 12% — a fundamental discrepancy in the data systems that must be explained.",
      "AI Orion-7 energy spike 340% 3 seconds before shutdown — this is not random failure, it is consistent with targeted overload.",
      "Remote command from Beijing 5 minutes before the main alarm cannot be ignored — correlation is not causation, but temporal proximity is significant.",
      "Backup node 4 shows a different version from telemetry prime — possible data tampering or sensor error requiring further investigation.",
      "Medical sensors show elevated heart rate starting 03:08 in 3 crew members in module C — antecedent to the alarm, showing crew detected something before the system alert."
    ],
    narrative: [
      "Data discrepancy (telemetry nominal vs backup log pressure drop) is the key issue. Backup log is more credible as it records actual sensor readings, not processed data. Remote command Beijing + medical antecedent heart rate suggest the crew may have been aware before the official alarm.",
      "Chronology: 03:08 elevated heart rate crew → 03:10 remote command Beijing → 03:12 comms burst → 03:15 pressure drop. Yet telemetry prime was NOMINAL for the first 10 minutes — this inconsistency cannot be explained without access to system architecture docs.",
      "Hypothesis: cascade failure triggered by a design flaw at junction C-7 exploited by remote command. But AI simulation cannot be used as definitive evidence since it is based on design assumptions."
    ]
  },
  politics: {
    contrib: [
      "Clause 4.2.a vs Addendum B is a direct conflict: verification completed at third party vs at PO signature. Both documents have equal legal force and require arbitration or clause interpretation to resolve ambiguity.",
      "72-hour email from Procurement is an internal non-binding target, but SLA T+5 days is also not signed — between these two, 72 hours is the more likely expectation.",
      "Invoice history: 12/15 last projects without formal verification shows an already-accepted practice — this pattern is relevant for interpreting parties intent.",
      "Legal memo from General Counsel reads clause in conjunction: verification = PO signature. However this is internal interpretation, not binding on the counterparty.",
      "WhatsApp screenshot saying 'sign first, verification can come later' is strong evidence against formal verification requirement — though whether this can serve as legal evidence still requires court determination."
    ],
    narrative: [
      "Contract contains 3 layers of ambiguity: (1) Clause 4.2.a vs Addendum B conflict, (2) 72-hour non-binding email, (3) unsigned SLA T+5. Interpretation principle: signed documents prevail over non-binding communications. Verification = PO signature under Addendum B.",
      "Invoice history pattern shows parties operated under a 'verification = fast enough' practice. However one pattern cannot change contractual obligation if the clause is clear. Addendum B prevails.",
      "Of all fragments, the most coherent: vendor expects fast verification (LinkedIn post + WhatsApp) but procurement policy + legal memo require formal verification. Reality is likely a middle ground: quick internal check + formal sign-off eventually."
    ]
  },
  conspiracy: {
    contrib: [
      "Video metadata is inconsistent — timestamp was modified after the fact. However modification of metadata is not proof the event did not occur, only that processing was non-standard.",
      "Social media analysis: 340 accounts posting in a coordinated manner within 47 seconds — this shows coordinated narrative control, not proof the event did not happen.",
      "FOIA batch 2 coordination plan 3 days before the event is factual evidence that must be questioned: plan for what? Cannot assume malicious without context.",
      "Expert audio: voice does not match location — consistent with wrong location claim, but does not prove the entire incident was not real.",
      "Witness variance: 8 explosions / 6 gunshots / 5 other sounds — in mass casualty events, conflicting witness accounts are the norm, not evidence of conspiracy."
    ],
    narrative: [
      "Verified facts: FOIA coordination plan 3 days before event, social media coordinated posting, metadata inconsistency, witness variance. Unverified: anonymous source citing 12 victims, expert audio deepfake claim. Principle: verify before rejecting.",
      "What cannot be explained by single event theory: coordination plan 3 days prior. But without access to the coordination plan contents, this claim is speculation. Strongest evidence is the social media coordinated posting — showing an information campaign.",
      "Facts vs speculation breakdown: verified = official report 3 victims + FOIA + social analysis; unverified = 12 anonymous victims, deepfake audio claim; questionable = coordination plan contents. Conclusion: something coordinated occurred, but specific claims cannot yet be verified."
    ]
  },
  heist: {
    contrib: [
      "2 different CCTV suspects in a 5-minute window shows at least 2 people involved — or 1 person in different disguises.",
      "Guard log 'all clear' at 23:50 contradicts CCTV footage showing activity — this shows the guard was either negligent or complicit.",
      "Cleaning staff ID used at 23:55 even though cleaning crew left at 23:15 — stolen or borrowed credential, strong evidence of insider involvement.",
      "Insurance appraisal increased $4M in the 6 weeks before theft — could be innocent valuation update or preparation for a false claim.",
      "Security vendor remote firmware update 23:00-01:00 is a perfect window to disable systems — this timing is too convenient to be coincidence."
    ],
    narrative: [
      "Strongest evidence: 2 different CCTV suspects + cleaning staff ID anomaly + security vendor firmware update window. Pattern shows coordinated effort with insider knowledge. But 2 CCTV suspects does not require 2 people — could be 1 person changing position. Most coherent theory: insider facilitates + external operator.",
      "Best-fitting chronology: firmware update (23:00) → fire suppression activated as cover (23:49) → CCTV suspects movement (23:47-23:52) → cleaning staff ID anomaly (23:55). Insider = cleaning staff credential. Unknown: who gave the order.",
      "Main theory vs alternative: (A) Staff insider + professional operator = 2 suspects in 5 min explains CCTV; (B) Single inside job = 1 person changing appearance = also explains CCTV. Evidence is not enough to choose one. Delivery crate 3 days prior may be a red herring or modus operandi."
    ]
  },
  corporate: {
    contrib: [
      "Singapore entity registered 14 Feb — 2 weeks BEFORE the 15 Feb board meeting discussing reorganization. This indicates advance planning, not opportunistic action.",
      "Legal memo draft never sent: 'may constitute regulatory violation' — although a draft, this shows internal awareness of a potential problem before the transfer.",
      "Wire transfer $50M authorized by CFO with 2FA token 28 Feb. This is not an unauthorized transaction. Question is not legality but appropriateness given board deliberations.",
      "Contractor invoice $480K submitted 3 Feb, approved same day by CFO — 3 weeks before Singapore planning discussions. This timing shows a pre-existing arrangement.",
      "HR records: 6 employees marked 'restructuring' in related division starting 1 Feb — 2 weeks before the board meeting. Downsizing concurrent with wire transfer may be coincidence or signal."
    ],
    narrative: [
      "Singapore entity registration 14 Feb is the key antecedent — planning for the Singapore deal began before the official board meeting. Wire transfer $50M authorized by CFO with 2FA = authorized transaction. Issue is not unauthorized but whether this was proper given regulatory concerns flagged in the legal memo.",
      "Most suspicious pattern: contractor invoice 3 Feb (pre-planning) → HR restructuring 1 Feb → Singapore registration 14 Feb → board meeting 15 Feb → legal memo draft (unclear timing) → wire transfer 28 Feb. This looks like an orchestrated sequence, not random events.",
      "Of all fragments, most verifiable: Singapore entity timing + contractor invoice pattern. Legal memo regulatory concern is a red flag but draft status = not final. Wire transfer with 2FA = authorized. Conclusion: there is a suspicious pattern but it was technically authorized."
    ]
  },
  historical: {
    contrib: [
      "War diary entry 14 November shows supply shortage already critical — this antecedent explains the surrender decision 3 days later.",
      "Intelligence report discrepancy: 11 divisions reported vs 9 actually present. This is not misinfo — likely inflated reporting structure.",
      "Weather log shows fog starting 05:30 and lifting at 09:00 — this 3.5-hour window perfectly matches fog cover for an undetected retreat.",
      "Diplomatic cable 48 hours before surrender mentions 'negotiation framework' — showing leadership was already considering surrender 2 days before the actual event.",
      "Medical records: 3 field hospital units overloaded starting 12 Nov — 2 days before surrender. Medical crisis as immediate trigger is more credible than strategic failure."
    ],
    narrative: [
      "Convergent chronology: fog window 05:30-09:00 + inflated intelligence numbers + medical overload 12 Nov + diplomatic pre-signal. This is not a single-cause surrender but a cascading crisis. Fog window provided tactical opportunity for a retreat that was already planned.",
      "Convergent evidence: supply shortage (war diary) + medical overload (field records) + diplomatic framework (cable) = systemic failure pattern. Fog merely provided a window to execute what was already necessary. Strategic decision overtaken by operational necessity.",
      "Of all fragments: supply shortage is the root cause, diplomatic cables show leadership was already exploring options, fog provided the tactical window. Most coherent narrative: retreat under fog cover was already planned as contingency when the supply situation became critical."
    ]
  },
  survival: {
    contrib: [
      "Water ration calculation: 8 people, 15L/day minimum = 120L needed. Collective had ~80L documented. 40L shortfall = survival math does not add up without external supplementation.",
      "Day 3 rescue signal timestamp discrepancy: radio log 06:30 vs individual claim midnight. This is not misremembering — possibility of coordination vs individual recall error.",
      "First responder timeline: officially arrived Day 5. But injured participant claims Day 4 night rescue attempt. This significant discrepancy needs to be explained.",
      "Personal GPS waypoint from one participant shows movement to higher ground Day 2 — contradicts 'stayed at base camp' narrative from same person.",
      "Medical evacuation record shows hypothermia cases in 2 participants arriving Day 5 morning — but base camp elevation doesn't explain hypothermia unless there was an overnight exposure event."
    ],
    narrative: [
      "Survival analysis: water shortfall + hypothermia at base camp elevation = contradictory unless there was an overnight exposure event. GPS waypoint to higher ground = one participant left camp at some point, either for help-seeking or other reason.",
      "Most coherent chronology: Day 2 someone went to higher ground (GPS) → Day 3 rescue signal (discrepant timing) → Day 4 night rescue attempt (first responder claim) → Day 5 morning evacuation (medical records). Sequence suggests someone was mobile when official narrative says stationary.",
      "Most concerning pattern: water shortfall is a fact, hypothermia at base camp elevation needs explanation, GPS movement contradicts stationary claim. Conclusion: there is incomplete information in the official narrative — but this does not necessarily indicate deception."
    ]
  }
};

function getExample(scenarioId, type) {
  const pool = EXAMPLES[scenarioId]?.[type] || EXAMPLES.mystery[type] || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "";
}

// Player avatar colors
const AVATAR_COLORS = [
  { cls: "avatar-cyan",   label: "Cyan"   },
  { cls: "avatar-mag",    label: "Magenta"},
  { cls: "avatar-yellow", label: "Yellow" },
  { cls: "avatar-green",  label: "Green"  },
  { cls: "avatar-red",    label: "Red"    }
];

const AVATAR_EMOJIS = ["🕵️", "🔍", "🛸", "🏛️", "🎨", "💼", "📜", "🏔️", "🕵️‍♀️", "🔬", "📡", "⚡"];

function getPlayerAvatar(index) {
  return AVATAR_EMOJIS[index % AVATAR_EMOJIS.length];
}

function getAvatarColor(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}
