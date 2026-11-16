/**
 * Publication-Grade Markdown Report Renderer for Reverse Engineer Logic (REL).
 * Strictly zero em-dashes; links every conclusion to cryptographic Evidence,
 * Obligation, Unknown, and Completion Ledger IDs.
 */
export function renderMarkdownReport(bundle) {
  const {
    subject,
    raw_text,
    decompilation,
    obligation_ledger,
    completion_ledger,
    exposition,
    unknowns,
    evidence_records,
  } = bundle;

  const lines = [];
  lines.push(`# Reverse Engineer Logic (REL) Investigation Report`);
  lines.push(``);
  lines.push(`- **Subject ID**: \`${subject.subject_id}\` (\`${subject.kind}\`, ${subject.char_length} chars)`);
  if (subject.context) {
    lines.push(`- **Situational Context**: ${subject.context}`);
  }
  lines.push(`- **Expounding Provider**: \`${exposition.provider_used.id}\` (${exposition.provider_used.name})`);
  lines.push(`- **Epistemic Authority / Confidence**: \`${exposition.authority}\` / \`${exposition.confidence}\``);
  lines.push(`- **Obligation Ledger ID**: \`${obligation_ledger.ledger_id}\` (${obligation_ledger.total_obligations} mandatory units: ${obligation_ledger.sentence_obligations} text units + ${obligation_ledger.omission_obligations} conspicuous omissions)`);
  lines.push(`- **Completion Ledger ID**: \`${completion_ledger.ledger_id}\` (Coverage: **${(completion_ledger.summary.coverage_ratio * 100).toFixed(1)}%**, Complete: \`${completion_ledger.summary.complete}\`)`);
  lines.push(`- **Authenticated Evidence Chain**: ${evidence_records.map((e) => `\`${e.evidence_id.slice(0, 19)}...\``).join(" -> ")}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);

  // Section 1: Executive Subtext Translation & Macro Architecture
  const ga = exposition.global_architecture;
  lines.push(`## 1. Executive Subtext Translation (What Is Actually Happening)`);
  lines.push(``);
  lines.push(`> ${ga.executive_subtext_translation}`);
  lines.push(``);
  lines.push(`### Macro Logical & Rhetorical Engineering`);
  lines.push(`${ga.core_logical_architecture}`);
  lines.push(``);
  lines.push(`### Macro Syllogistic Chain (Premises -> Target Behavioral Outcome)`);
  for (const [i, step] of (ga.syllogistic_macro_chain || []).entries()) {
    lines.push(`${i + 1}. ${step}`);
  }
  lines.push(``);

  // Section 2: Actor Incentive & Game-Theoretic Matrix
  lines.push(`## 2. Actor Incentive, Fear & BATNA Geometry`);
  lines.push(``);
  for (const actor of ga.actor_incentive_matrix || []) {
    lines.push(`### Actor: ${actor.actor}`);
    lines.push(`- **Public / Stated Goal**: ${actor.stated_goal}`);
    lines.push(`- **Revealed Underlying Incentives**: ${actor.revealed_incentives}`);
    lines.push(`- **Core Fears / Loss Aversions**: ${actor.core_fears_or_aversions}`);
    lines.push(`- **Bargaining Leverage & BATNA**: ${actor.leverage_and_batna}`);
    lines.push(``);
  }

  // Section 3: Exhaustive Unit-by-Unit Logic & Motivation Decompilation
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 3. Unit-by-Unit Logic & Motivation Dossiers (100% Obligation Coverage)`);
  lines.push(``);

  const expById = new Map(exposition.unit_expositions.map((u) => [u.unit_id, u]));
  for (const unit of decompilation.units) {
    const exp = expById.get(unit.unit_id);
    const obl = obligation_ledger.obligations.find((o) => o.unit_id === unit.unit_id);
    lines.push(`### [${unit.unit_id}] Span \`[${unit.span.start}..${unit.span.end}]\`${unit.speaker ? ` | Speaker: **${unit.speaker}**` : ""} | Obligation \`${obl?.obligation_id.slice(0, 16)}...\``);
    lines.push(``);
    lines.push(`> "${unit.text}"`);
    lines.push(``);
    lines.push(`- **Speech Acts**: ${unit.speech_acts.map((a) => `\`${a}\``).join(", ")} | **Commitment Profile**: \`${unit.agency_and_commitment.commitment_profile}\``);
    if (unit.signals.length > 0) {
      lines.push(`- **Detected Micro-Signals (${unit.signals.length})**: ${unit.signals.map((s) => `\`${s.code}\` (*"${s.match}"*)`).join(", ")}`);
    }
    if (unit.clauses.length > 1) {
      lines.push(`- **Clause Pivot Split**:`);
      for (const cl of unit.clauses) {
        lines.push(`  - \`${cl.role}\`${cl.connector ? ` (hinge: *"${cl.connector}"*)` : ""}: "${cl.text}"`);
      }
    }
    lines.push(``);
    lines.push(`1. **Literal Surface Claim**: ${exp.literal_surface}`);
    lines.push(`2. **Operational Function (Why This Exists Here)**: ${exp.operational_function}`);
    lines.push(`3. **Underlying Logic Chain**:`);
    for (const step of exp.logic_chain || []) {
      lines.push(`   - ${step}`);
    }
    lines.push(`4. **Unstated Load-Bearing Premises**:`);
    for (const hp of exp.hidden_premises || []) {
      lines.push(`   - ${hp}`);
    }
    lines.push(`5. **Four-Layer Motivational Stack**:`);
    lines.push(`   - *Surface Motive (Public Optics)*: ${exp.motivational_stack.surface_motive}`);
    lines.push(`   - *Tactical Motive (Conversational Leverage)*: ${exp.motivational_stack.tactical_motive}`);
    lines.push(`   - *Core Self-Interest (Payoff / Risk / Optionality)*: ${exp.motivational_stack.core_self_interest}`);
    lines.push(`   - *Ego / Face / Deniability Protection*: ${exp.motivational_stack.ego_or_face_protection}`);
    lines.push(`6. **Word-Choice & Syntax Forensics**: ${exp.word_choice_forensics}`);
    lines.push(`7. **Counterfactual Candid Translation**: ${exp.counterfactual_translation}`);
    lines.push(`8. **Competing Motivational Hypotheses**:`);
    for (const h of exp.hypotheses || []) {
      const pct = typeof h.probability === "number" ? `${Math.round(h.probability * 100)}%` : h.probability;
      lines.push(`   - **${h.id} (${pct}) - ${h.label}**: ${h.rationale}`);
    }
    if (exp.diagnostic_probe) {
      lines.push(`9. **Falsification / Diagnostic Probe**:`);
      lines.push(`   - *Probe*: ${exp.diagnostic_probe.probe_question_or_action}`);
      lines.push(`   - *If H1 is true*: ${exp.diagnostic_probe.if_h1_true_expect}`);
      lines.push(`   - *If H2 is true*: ${exp.diagnostic_probe.if_h2_true_expect}`);
    }
    lines.push(``);
  }

  // Section 4: Conspicuous Omissions (What Was NOT Said)
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 4. Conspicuous Omissions (Strategic Silences & Missing Variables)`);
  lines.push(``);
  const omById = new Map(exposition.omission_expositions.map((o) => [o.omission_id, o]));
  for (const om of decompilation.conspicuous_omissions) {
    const exp = omById.get(om.omission_id);
    lines.push(`### [${om.omission_id}] ${om.title} (\`${om.slot}\`)`);
    lines.push(`- **Trigger Observation**: ${om.trigger_observation}`);
    lines.push(`- **Why Expected in Candid Baseline**: ${exp.why_expected}`);
    lines.push(`- **Strategic Benefit of Silence**: ${exp.strategic_function_of_silence}`);
    lines.push(`- **Hypotheses**:`);
    for (const h of exp.hypotheses || []) {
      const pct = typeof h.probability === "number" ? `${Math.round(h.probability * 100)}%` : h.probability;
      lines.push(`  - **${h.id} (${pct}) - ${h.label}**: ${h.rationale}`);
    }
    lines.push(`- **Diagnostic Probe to Surface It**: ${exp.diagnostic_probe}`);
    lines.push(``);
  }

  // Section 5: Residual Unknowns Registry & Strategic Playbook
  lines.push(`---`);
  lines.push(``);
  lines.push(`## 5. Residual Unknowns Registry (\`unk_...\`) & Strategic Counter-Playbook`);
  lines.push(``);
  for (const u of unknowns || []) {
    lines.push(`- **\`${u.unknown_id.slice(0, 20)}...\`** [Severity: \`${u.severity}\` | Status: \`${u.status}\` | Rev \`${u.revision}\`]: **${u.question}**`);
    for (const p of u.recommended_probes || []) {
      lines.push(`  - *Probe*: ${p.operation} (*Rationale*: ${p.rationale})`);
    }
  }
  lines.push(``);
  lines.push(`### Actionable Response Playbook`);
  lines.push(``);
  for (const play of ga.strategic_response_playbook || []) {
    lines.push(`#### ${play.strategy_name}`);
    lines.push(`- **When to Use**: ${play.when_to_use}`);
    lines.push(`- **Exact Script / Action**: ${play.exact_move_or_script}`);
    lines.push(`- **Expected Counter-Reaction**: ${play.expected_counter_reaction}`);
    lines.push(``);
  }

  return lines.join("\n").replace(/\u2014/g, " - ");
}
