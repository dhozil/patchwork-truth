// Scenario packs — rich multi-fragment scenarios for Patchwork Truth
const SCENARIOS = {
  mystery: {
    id: "mystery",
    label: "Mystery Investigation",
    emoji: "🔍",
    color: "#ff0080",
    tagline: "Collect evidence, find the truth.",
    prompt: "An incident at a facility. Evidence contradicts each other.",
    fragments: [
      { type: "Witness A", text: "Witness A heard a loud bang at 19:05 coming from the eastern area of the facility." },
      { type: "Witness B", text: "Witness B said they just passed by the kitchen and smelled a strange chemical odor, similar to ozone." },
      { type: "Witness C", text: "Witness C: 'I saw someone in a dark hoodie running toward the east exit at 19:10.'" },
      { type: "Sensor Log", text: "Sensor log recorded an anomalous signal spike at 19:07 in the main processing zone." },
      { type: "Access Log", text: "Access log shows the Manager's ID card was used at the server room door at 18:58 — even though the manager is on leave." },
      { type: "Camera", text: "Main security camera went dark for exactly 40 seconds — 3 key frames systematically missing." },
      { type: "Thermal", text: "Thermal sensor showed a 2.3°C temperature spike in the electrical panel room 3 minutes before the incident." },
      { type: "Anonymous 1", text: "Anonymous report submitted 20 minutes after the incident: 'The entire event was planned well in advance.'" },
      { type: "Anonymous 2", text: "Second anonymous email: 'Pay attention to maintenance ticket #4471 — that's the key to everything.'" },
      { type: "Maintenance", text: "Maintenance ticket #4471 dated 2 days before the incident: 'Fault in circuit breaker zone C needs attention ASAP.'" },
      { type: "Sound Log", text: "Sound analysis from the corridor microphone recorded uneven footsteps — someone was walking abnormally." },
      { type: "Audit Log", text: "Security audit log: two manual remote overrides performed at 18:45 from an external IP, location unidentified." },
      { type: "Inventory", text: "Inventory check: 3 units marked 'For Maintenance Only' were not found in storage after the incident." },
      { type: "Witness D", text: "Witness D: 'I saw 2 people in suits talking in the parking lot 10 minutes before the alarm.'" },
      { type: "Network", text: "Network log shows a VPN connection from outside the city to the internal server started at 18:30, lasting 45 minutes." },
      { type: "Incident Report", text: "Official incident report only mentions 'minor electrical fault' — however damage assessment shows otherwise." }
    ],
    guideContribution: "Claim must reference specific evidence + narrative impact. Example: '19:05 bang + thermal spike = strong evidence...'",
    guideNarrative: "Final narrative: combine strongest evidence, acknowledge uncertainty (missing frames, anonymous reports), avoid baseless accusations."
  },

  scifi: {
    id: "scifi",
    label: "Space Crisis",
    emoji: "🛸",
    color: "#00e5ff",
    tagline: "Preserve the colony. Verify the facts.",
    prompt: "Disaster at a space station. Data conflicts.",
    fragments: [
      { type: "Pressure Sensor", text: "Pressure sensor shows a drastic 12% drop in module C at 03:15 local time." },
      { type: "Telemetry Prime", text: "Main telemetry data shows all systems 'NOMINAL' for the first 10 minutes of the incident — contradictory to sensor." },
      { type: "Crew Log", text: "Crew log: 'I heard metal cracking sounds, similar to compartment wall breaking.'" },
      { type: "AI Core", text: "Central AI Orion-7 recorded an energy anomaly 3 seconds before total shutdown — 340% spike from baseline." },
      { type: "Backup Log", text: "Backup telemetry node 4 shows a different version: 'pressure drop detected' not 'all nominal'." },
      { type: "Maintenance", text: "Maintenance manifest: last service for module C was 14 days before the incident — outside normal 7-day schedule." },
      { type: "Remote Cmd", text: "Two remote commands from Beijing ground control received at 03:10 — 5 minutes before main alarm." },
      { type: "Crew Comms", text: "Crew comms channel 3 shows a 0.8-second transmission burst to an unknown direction at 03:12." },
      { type: "Camera Feed", text: "Camera feed from module C recorded a 0.3-second blue flash before pressure sensor drop — consistent with electrical arc." },
      { type: "Oxygen", text: "Oxygen level sensor showed 21.0% right before incident — then 19.8% 2 minutes after alarm." },
      { type: "Motion", text: "Motion sensor in module C detected unidentified movement for 47 seconds before system went dark." },
      { type: "Power Grid", text: "Power grid log: energy distribution to module C increased 18% 30 seconds before incident — abnormal load pattern." },
      { type: "Communication", text: "Houston ground station detected an unusual harmonic interference pattern on 2.4GHz frequency 8 minutes before incident." },
      { type: "Medical", text: "Medical sensor for crew showed elevated heart rate for 3 crew members in module C starting 03:08 — before alarm." },
      { type: "Simulation", text: "Post-incident AI simulation: 'cascade failure due to design flaw in junction C-7' — but design was approved 3 months ago." },
      { type: "Black Box", text: "Black box recovered shows a 4.7-second timestamp mismatch — possible tampering detected." }
    ],
    guideContribution: "Use technical terminology + chronology. Example: 'Telemetry vs backup log = discrepancy, chronology 03:10 remote cmd...'",
    guideNarrative: "Final narrative: identify chronology from fragments, acknowledge data discrepancy (telemetry vs backup), avoid oversimplification."
  },

  politics: {
    id: "politics",
    label: "Political Contract",
    emoji: "🏛️",
    color: "#ffe600",
    tagline: "Negotiate, integrate, resolve.",
    prompt: "A public contract was signed. Clauses conflict.",
    fragments: [
      { type: "Main Contract", text: "Clause 4.2.a: 'Payment shall be made after verification is completed by an independent third party.'" },
      { type: "Contract Addendum", text: "Addendum B, Paragraph 2: 'Verification is deemed complete when PO is signed by the Procurement Head.'" },
      { type: "Internal Email", text: "Email from Procurement to Finance: 'Verification will be processed within 72 hours after contract signing.'" },
      { type: "Legal Email", text: "Legal dept reply: '72 hours is an internal target, not a binding obligation — see Clause 4.2.a note 1.'" },
      { type: "Audit Report", text: "Independent audit found 3 inconsistencies: 'verification' is defined differently across 4 documents." },
      { type: "Legal Memo", text: "Memo from General Counsel: 'Clause 4.2.a must be read in conjunction with Addendum B — legal interpretation: verification = PO signature.'" },
      { type: "Verbal Recording", text: "Meeting recording 15 April: VP Vendor stated verbally 'verification complete in 48 hours max.'" },
      { type: "Social Media", text: "Vendor LinkedIn post 3 days before signing: 'Instant verification ready — our system is built for speed!'" },
      { type: "SLA Document", text: "Unsigned SLA attachment: 'Response time for verification is T+5 business days.'" },
      { type: "Invoice History", text: "Vendor invoice history: 12 of 15 last projects had payment released in <48 hours without formal verification." },
      { type: "Internal Policy", text: "Internal procurement policy rev.3: 'All verification must include QC sign-off + Finance approval.'" },
      { type: "Committee Notes", text: "Committee meeting notes 22 March: 'Vendor proposed self-verification — REJECTED, must be third party.'" },
      { type: "WhatsApp", text: "WhatsApp screenshot from procurement staff to vendor: 'Just go ahead and sign first, verification can come later.'" },
      { type: "Legal Opinion", text: "External legal opinion dated 5 May: 'Verbal agreements do not have binding legal force.'" },
      { type: "Press Release", text: "Vendor press release dated 1 May: 'We are committed to verification transparency for all stakeholders.'" },
      { type: "Finance Log", text: "Finance system log: payment batch #BJ-2024-047 released 46 hours post-signing — without QC sign-off." }
    ],
    guideContribution: "Quote specific clauses + interpretation. Example: 'Clause 4.2.a vs Addendum B = conflict, 72-hour email vs 5-day SLA...'",
    guideNarrative: "Final narrative: summarize most coherent legal interpretation, acknowledge ambiguity (verbal vs written), avoid absolutism."
  },

  conspiracy: {
    id: "conspiracy",
    label: "Conspiracy Theory",
    emoji: "🕵️",
    color: "#a855f7",
    tagline: "Facts vs speculation. Find the boundary.",
    prompt: "Theories circulate. Evidence incomplete. What can be trusted?",
    fragments: [
      { type: "Official Report", text: "Official government report: 3 victims, location block F, incident time 22:00 — final investigation result." },
      { type: "Alt Report", text: "Citizen journalist investigation: at least 7 victims, actual location wider than official version." },
      { type: "Media Witnesses", text: "20+ eyewitnesses on Twitter/X give different versions — 8 say explosion, 6 say gunfire, 5 say other sounds." },
      { type: "Direct Witness", text: "Direct witness from opposite apartment: 'I saw 2 black vans with no plates in the parking lot 30 minutes before the incident.'" },
      { type: "FOIA Doc 1", text: "FOIA (Freedom of Information Act) batch one: 47 pages, 60% redacted for 'national security' reasons." },
      { type: "FOIA Doc 2", text: "FOIA batch two (leaked): internal email between two agencies mentioning a coordination plan 3 days before the event." },
      { type: "Digital Expert", text: "Independent digital forensics expert: 'Metadata from circulating video is inconsistent — timestamp was modified after the fact.'" },
      { type: "Audio Expert", text: "Audio analyst: 'Background voice in the video does not match the claimed location — possibly deepfake.'" },
      { type: "High Anonymous", text: "High-level anonymous source: 'Actual victims are 12, intentionally minimized to avoid panic.'" },
      { type: "Staff Anonymous", text: "Anonymous from within agency: 'We were ordered to focus on 1 narrative only — everything else is distraction.'" },
      { type: "CCTV Video", text: "Closed-circuit video 4 seconds showing a mysterious figure approaching the building 5 seconds before first responders." },
      { type: "Drone Video", text: "Citizen drone footage: shows a cylindrical metallic object falling from the roof 3 seconds before ground impact." },
      { type: "Social Graph", text: "Social media analysis: 340 accounts posting the exact same version within 47 seconds after the event — coordinated." },
      { type: "Financial Trail", text: "Financial tracking: company mentioned in conspiracy theory has connection to 3 board members from the relevant agency." },
      { type: "Historical", text: "Historical pattern analysis: 4 similar incidents in the last 10 years, all with similar characteristics — coordination?" },
      { type: "Counter Intel", text: "Counter-intelligence official: 'Social media narrative has been manipulated by a foreign state — this is information warfare, not conspiracy.'" }
    ],
    guideContribution: "Separate facts from speculation. Example: 'FOIA docs = verified fact, anonymous claims = unverified, witness variance = need cross-check...'",
    guideNarrative: "Final narrative: acknowledge information limitations, prioritize strongest evidence, reject without proof — explain why certain theories cannot be trusted."
  },

  heist: {
    id: "heist",
    label: "Art Heist",
    emoji: "🎨",
    color: "#ff6b35",
    tagline: "One painting. Many suspects. Zero truth.",
    prompt: "A $40M painting stolen from a museum. Who did it?",
    fragments: [
      { type: "CCTV 1", text: "Main corridor CCTV recorded a figure in glasses and black jacket entering restricted area at 23:47. No badge visible." },
      { type: "CCTV 2", text: "Other CCTV recorded a different figure at 23:52 — baseball cap, more muscular build, walking faster." },
      { type: "Guard Log", text: "Guard shift log: all 6 guards on duty reported area 'all clear' at 23:50 — contradicts CCTV footage." },
      { type: "Fire System", text: "Fire suppression system activated automatically at 23:49 — system claim: smoke sensor triggered. No trace of smoke." },
      { type: "Cleaning Crew", text: "Cleaning crew schedule: last team left at 23:15. However access log shows cleaning staff ID used at 23:55." },
      { type: "Restoration Log", text: "Museum restoration log: painting 'The Last Meridian' was in restoration — scheduled return to display: tomorrow morning." },
      { type: "Insurance", text: "Insurance appraisal 3 months ago: painting valued at $38M. Latest appraisal 2 weeks ago: $42M — up $4M in 6 weeks." },
      { type: "Staff Mobile", text: "Mobile data tracking: 4 staff members were in the museum area between 23:30-00:00, but only 1 officially clocked in." },
      { type: "Anonymous Note", text: "Anonymous note found in waste bin next morning: 'The painting was never in Room 12. Check the basement.'" },
      { type: "Art Expert", text: "Art restoration expert: 'Signature brushwork does not match The Last Meridian — this may not be the original piece.'" },
      { type: "Security Vendor", text: "Security system vendor email: 'We will remote update firmware tonight 23:00-01:00 — system will be offline briefly.'" },
      { type: "Delivery Note", text: "Delivery order 3 days prior: a crate 120x80x60cm delivered to museum loading dock. Received by staff signature." },
      { type: "Social Post", text: "Museum director posted Instagram story at 22:30: 'Quiet night at the museum... 👀' with selfie in front of the painting." },
      { type: "Temperature", text: "Climate control log: temperature in Room 12 dropped 1.5°C between 23:48-23:53 — abnormal for AC system." },
      { type: "Witness Janitor", text: "Cleaning staff interview: 'I saw someone dressed like a courier carrying something large out of the side door.'" },
      { type: "Museum App", text: "Museum mobile app debug log: 3 failed authentication attempts from external IP at 23:51 — attempted hack?" }
    ],
    guideContribution: "Cross-reference CCTV vs guard log vs mobile tracking. Example: '2 CCTV suspects vs guard all clear = discrepancy, mobile tracking identifies 4 suspects...'",
    guideNarrative: "Final narrative: build timeline from fragments, identify inconsistency between evidence, determine who is most likely — with caveat of incomplete evidence."
  },

  corporate: {
    id: "corporate",
    label: "Corporate Scandal",
    emoji: "💼",
    color: "#6366f1",
    tagline: "Follow the money. Trust no one.",
    prompt: "A tech unicorn lost $50M. Who took it?",
    fragments: [
      { type: "Board Minutes", text: "Board meeting minutes 15 Feb: 'Division X will be reorganized, budget redirected to emerging markets.'" },
      { type: "Wire Transfer", text: "SWIFT wire transfer $50M to Singapore entity dated 28 Feb, authorized by CFO with 2FA token." },
      { type: "CFO Email", text: "Email from CFO to CEO 27 Feb: 'We need to move fast on the Singapore deal before Q2 reporting.'" },
      { type: "Legal Opinion", text: "Legal dept memo (draft, never sent): 'Singapore entity structure may constitute regulatory violation in certain jurisdictions.'" },
      { type: "HR File", text: "HR record: 3 engineers from division X resigned within 2 weeks before transfer, all to different countries." },
      { type: "Accounting", text: "Internal accounting adjustment $50M reclassified as 'strategic investment — APAC region' in Q1 report." },
      { type: "Audit Trail", text: "External audit working paper: 'Verification of Singapore entity principals requested — no response after 3 requests.'" },
      { type: "Slack Message", text: "Leaked Slack DM between VP and CFO: 'Don't worry, this is covered. Everything will look normal after audit.'" },
      { type: "Registration", text: "Singapore company registry: entity registered 14 Feb — 2 weeks before board meeting, 6 weeks before transfer." },
      { type: "Director LinkedIn", text: "LinkedIn profile of Singapore entity director: same alma mater as CFO, same graduation year." },
      { type: "Whistleblower", text: "Anonymous whistleblower: 'I know the funds never went to the operational Singapore office. There is no office.'" },
      { type: "Payroll", text: "Payroll records: 2 staff in Singapore entity paid from Hong Kong account, not from Singapore entity account." },
      { type: "Investor Call", text: "Investor quarterly call transcript: CEO stated 'APAC strategic investment on track' — no disclosure of amount." },
      { type: "Compliance", text: "Compliance officer sign-off document dated 26 Feb: 'Transaction reviewed and approved — no red flags identified.'" },
      { type: "Bank Statement", text: "Bank statement Singapore entity — 3 months activity: all incoming transfers (total $50M) immediately swept to another account same day." },
      { type: "Forensic", text: "Digital forensic report: CFO laptop showed encrypted archive created 25 Feb, deleted 1 Mar — file name: 'contingency_apac.xlsx'" }
    ],
    guideContribution: "Follow the money trail. Example: 'Singapore entity registration 14 Feb + CFO/director connection + wire sweep pattern = coordinated move...'",
    guideNarrative: "Final narrative: trace fund flow + personal relationships + timing, identify primary actor + extent of involvement."
  },

  historical: {
    id: "historical",
    label: "Historical Mystery",
    emoji: "📜",
    color: "#d4a574",
    tagline: "The past is never truly gone.",
    prompt: "A historical event still disputed. What actually happened?",
    fragments: [
      { type: "Official Record", text: "Official government records: 847 residents left the city in 3 days, cause stated as 'economic migration.'" },
      { type: "Newspaper 1", text: "Local newspaper edition 12 March 1962: 'Mass exodus due to uncontrolled security situation.'" },
      { type: "Newspaper 2", text: "National newspaper same edition: 'No indication of significant conflict in the area.'" },
      { type: "Memoir", text: "Mid-level official memoir: 'We were ordered not to document what actually happened that night.'" },
      { type: "Photo Archive", text: "Citizen photo archive: 14 black-and-white photos showing a military vehicle convoy leaving the city at 02:00." },
      { type: "Telegram", text: "Decrypted telegram from central command dated 11 March: 'Ensure no documentation remains. Full sanitization authorized.'" },
      { type: "Population", text: "District population data from 1960 vs 1965 census: 23% decrease cannot be explained by birth/death rate." },
      { type: "Witness Child", text: "Witness now 70+ (was 8 at the time): 'My parents built bunkers in the backyard before the big event.'" },
      { type: "Cemetery", text: "Town cemetery records: 112 more burials in March 1962 compared to monthly average of 8 — 1400% spike." },
      { type: "Archive Letter", text: "Letter from national archive (declassified 2020): 'Request for transfer of all local administrative records approved — reason: national security.'" },
      { type: "Interview", text: "Oral history interview with former administrator (recorded 1998): 'I was told to sign documents I wasn't allowed to read.'" },
      { type: "Map Change", text: "Topographic maps from 1961 vs 1963: entire blocks of buildings disappeared from survey records — no demolition permit found." },
      { type: "School Records", text: "School enrollment records: attendance dropped 78% in March-April 1962 — no explanation in administrative records." },
      { type: "Military Record", text: "Demobilized military personnel record (partially available): 3 units from the area were gathered for 'special assignment' Feb 1962." },
      { type: "Foreign Diplomat", text: "Diplomatic cable (leaked) from foreign ambassador: 'Intelligence suggests significant civilian relocation under unclear circumstances.'" },
      { type: "Museum", text: "Local museum exhibit (closed 1975): all artifacts collected from that event were missing from inventory post-1975." }
    ],
    guideContribution: "Cross-reference conflicting sources. Example: 'Official record vs newspaper vs memoir vs telegram = multi-layered narrative...'",
    guideNarrative: "Final narrative: identify pattern from fragments, acknowledge gaps in historical record, draw conclusions based on weight of evidence."
  },

  survival: {
    id: "survival",
    label: "Survival Island",
    emoji: "🏔️",
    color: "#22c55e",
    tagline: "Trust is a liability. Survival is priority.",
    prompt: "12 people stranded on a remote island. One by one they start disappearing. Who is the real predator?",
    fragments: [
      { type: "Manifest", text: "Survival situation manifest: 12 people (6 crew + 4 researchers + 2 journalists), crashed on remote island Coordinates: S 12°34', W 75°22'." },
      { type: "Logbook", text: "Captain log: 'Day 4, supplies for 7 days. Strict rationing starts now.'" },
      { type: "Found 1", text: "Researcher #1 journal entry: 'Marco has been spooked since last night's incident. He said he heard something from the forest.'" },
      { type: "Audio", text: "Emergency beacon audio recording: background sound analysis — 2 distinct human vocalizations, 1 with distress characteristics." },
      { type: "Witness", text: "Journalist #1 interview: 'I saw Dr. Lin leaving camp with a knife and backpack around 02:00 — looks determined.'" },
      { type: "Found 2", text: "Journal entry day 3: 'Chen is missing. Suspected to have wandered off — but he is a survival expert. Makes no sense.'" },
      { type: "Footprint", text: "Beach footprint analysis: 3 different boot patterns heading toward the jungle — 2 identified (Chen's boot + unknown), 1 too degraded." },
      { type: "Signal", text: "Satellite phone log: call attempt to rescue center at 05:30 on day 2 — lasted 47 seconds before termination. Audio partially recovered." },
      { type: "Note", text: "Note found in Chen's tent: 'Don't trust the water. And watch your back around the others.' — handwriting confirmed as Chen's." },
      { type: "Medical", text: "Medical log: 3 people experienced food poisoning-like symptoms within 48 hours — source unidentified." },
      { type: "Audio Fragment", text: "Recovered audio: '...they're hiding something...the crash was not...' — interrupted by static." },
      { type: "Map", text: "Hand-drawn map from Marco found in waste: shows marked locations 'base', 'cache', and 'danger zone' — all coordinates not on official map." },
      { type: "Found 3", text: "Journal entry day 5: 'I found hidden supplies in a cave — not from us. Someone else was here before.'" },
      { type: "Witness 2", text: "Journalist #2: 'I suspect there was a conflict between Marco and the captain over evacuation plan. Something off.'" },
      { type: "Signal Beacon", text: "Secondary beacon found activated but frequencies changed — does not match official distress protocol." },
      { type: "Final Log", text: "Captain's final log entry (day 6): 'Tomorrow we move. If I don't make it — the truth is in the cave. Trust no one.'" }
    ],
    guideContribution: "Build timeline from journal entries + identify suspicious patterns. Example: 'Chen the expert wander off + footprint trail = possible foul play, cave supplies = other actors...'",
    guideNarrative: "Final narrative: determine who is the highest threat, what actually happened, who survived and why."
  }
};

// Available scenario list
function getScenarios() {
  return Object.values(SCENARIOS).map(({ id, label, emoji, tagline, color }) => ({
    id, label, emoji, tagline, color
  }));
}

function getScenario(id) {
  return SCENARIOS[id] || SCENARIOS.mystery;
}

function getFragmentsForScenario(scenarioId) {
  const scenario = getScenario(scenarioId);
  return scenario.fragments;
}

// Randomize fragments — select N random fragments per player
function getShuffledFragments(scenarioId, count = 3) {
  const frags = getFragmentsForScenario(scenarioId);
  const shuffled = [...frags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, frags.length));
}

module.exports = {
  SCENARIOS,
  getScenarios,
  getScenario,
  getFragmentsForScenario,
  getShuffledFragments
};