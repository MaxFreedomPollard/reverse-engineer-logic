import { decompileSubject } from "./decompiler.mjs";
import { createSubject } from "../domain/ledgers.mjs";

/**
 * Compare two messages, drafts, or situational framings (modeled on REA's
 * compare_functions & find_changed_behavior).
 * Pinpoints walked-back commitments, newly injected hedges, shifted agency/blame,
 * and altered leverage between Left (Baseline/V1) and Right (Revised/V2).
 */
export function compareFramings(leftText, rightText, options = {}) {
  const leftSubject = createSubject(leftText, { title: options.leftTitle || "baseline-v1" });
  const rightSubject = createSubject(rightText, { title: options.rightTitle || "revised-v2" });

  const leftDec = decompileSubject(leftSubject, leftText);
  const rightDec = decompileSubject(rightSubject, rightText);

  const allCodes = new Set([
    ...Object.keys(leftDec.statistics.signal_histogram),
    ...Object.keys(rightDec.statistics.signal_histogram),
  ]);

  const signalDeltas = [];
  for (const code of [...allCodes].sort()) {
    const l = leftDec.statistics.signal_histogram[code] || 0;
    const r = rightDec.statistics.signal_histogram[code] || 0;
    if (l !== r) {
      signalDeltas.push({
        signal_code: code,
        left_count: l,
        right_count: r,
        delta: r - l,
        interpretation: interpretSignalShift(code, l, r),
      });
    }
  }

  const leftHardCommits = leftDec.units.filter((u) => u.agency_and_commitment.commitment_profile === "hard-binding").length;
  const rightHardCommits = rightDec.units.filter((u) => u.agency_and_commitment.commitment_profile === "hard-binding").length;
  const leftSoft = leftDec.units.filter((u) => u.agency_and_commitment.commitment_profile === "soft-nonbinding-optionality").length;
  const rightSoft = rightDec.units.filter((u) => u.agency_and_commitment.commitment_profile === "soft-nonbinding-optionality").length;

  const behavioralShifts = [];
  if (rightHardCommits < leftHardCommits || rightSoft > leftSoft) {
    behavioralShifts.push({
      shift_kind: "COMMITMENT_WALKBACK",
      summary: `Hard binding units dropped (${leftHardCommits} -> ${rightHardCommits}) while soft optionality units rose (${leftSoft} -> ${rightSoft}), indicating the actor is quietly retreating from enforceable promises.`,
    });
  }
  if ((rightDec.statistics.signal_histogram.PASSIVE_AGENCY_ERASURE || 0) > (leftDec.statistics.signal_histogram.PASSIVE_AGENCY_ERASURE || 0)) {
    behavioralShifts.push({
      shift_kind: "ACCOUNTABILITY_DISTANCING",
      summary: "Passive agency erasure increased in V2: personal ownership ('I/we') was edited out to insulate the author from blame.",
    });
  }
  if ((rightDec.statistics.signal_histogram.EXTERNALIZED_BLOCKER || 0) > (leftDec.statistics.signal_histogram.EXTERNALIZED_BLOCKER || 0)) {
    behavioralShifts.push({
      shift_kind: "AUTHORITY_SHIELD_INSERTION",
      summary: "V2 introduces externalized blockers ('policy', 'legal', 'committee') absent in V1 to justify a tougher bargaining stance.",
    });
  }
  if (behavioralShifts.length === 0) {
    behavioralShifts.push({
      shift_kind: "REFRAMING_OR_SCOPE_ADJUSTMENT",
      summary: `Unit count shifted (${leftDec.statistics.unit_count} -> ${rightDec.statistics.unit_count}) and micro-signals shifted (${leftDec.statistics.total_micro_signals} -> ${rightDec.statistics.total_micro_signals}).`,
    });
  }

  return {
    left_subject: leftSubject,
    right_subject: rightSubject,
    unit_count_delta: {
      left: leftDec.statistics.unit_count,
      right: rightDec.statistics.unit_count,
      delta: rightDec.statistics.unit_count - leftDec.statistics.unit_count,
    },
    signal_deltas: signalDeltas,
    behavioral_shifts: behavioralShifts,
  };
}

function interpretSignalShift(code, l, r) {
  const dir = r > l ? "increased" : "decreased";
  switch (code) {
    case "EPISTEMIC_HEDGE":
      return r > l
        ? "Increased hedging: confidence dropped or legal/reputational deniability was added."
        : "Removed hedges: actor shifted to a firmer, higher-certainty stance.";
    case "VAGUE_COMMITMENT_HORIZON":
    case "STRATEGIC_ESCAPE_HATCH":
      return r > l
        ? "Added escape hatches / elastic timelines to dilute binding obligation."
        : "Tightened commitment language by removing escape hatches.";
    case "ADVERSATIVE_PIVOT":
      return `Adversative 'yes-but' cushioning ${dir} (${l} -> ${r}).`;
    case "NUMERIC_OR_TEMPORAL_ANCHOR":
      return r > l
        ? "Introduced concrete numbers/dates (harder specificity)."
        : "Stripped concrete numbers/dates (retreating into strategic vagueness).";
    default:
      return `${code} ${dir} from ${l} to ${r}.`;
  }
}
