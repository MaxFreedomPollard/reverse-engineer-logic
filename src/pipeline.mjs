import {
  buildObligationLedger,
  createEvidence,
  createResidualUnknown,
  createSubject,
  evaluateExpositionCoverage,
  verifyEvidenceIntegrity,
} from "./domain/ledgers.mjs";
import { decompileSubject } from "./engine/decompiler.mjs";
import { expoundAllObligations } from "./engine/expounder.mjs";
import { compareFramings } from "./engine/comparator.mjs";

/**
 * Execute a full REA-grade Reverse Engineer Logic investigation:
 *   1. Subject Identity & SHA-256 Digest (`sub_...`)
 *   2. Deterministic Pragmatic/Rhetorical/Omission Decompilation (`ev_...`)
 *   3. Mandatory Unit + Omission Obligation Ledger (`obl_...`)
 *   4. Deep Multi-Layer Logic & Motivation Expounding (`ev_...`)
 *   5. Residual Unknown & Falsification Probe Registry (`unk_...`)
 *   6. Cryptographic Completion Ledger Verification (`ecl_...`)
 */
export async function runFullInvestigation(rawText, options = {}) {
  const subject = createSubject(rawText, {
    title: options.title,
    context: options.context,
    kind: options.kind,
  });

  // Step 1: Deterministic structural & micro-signal decompilation
  const decompilation = decompileSubject(subject, rawText);
  const decompEvidence = createEvidence({
    subject,
    provider: { id: "rel-decompiler", name: "REL Pragmatic & Structural Decompiler", version: "1.0.0" },
    predicateType: "rel.decompilation",
    operation: "decompile_logic_structure",
    parameters: { char_length: subject.char_length },
    normalizedResult: {
      statistics: decompilation.statistics,
      unit_ids: decompilation.units.map((u) => u.unit_id),
      omission_ids: decompilation.conspicuous_omissions.map((o) => o.omission_id),
    },
    confidence: "observed",
    authority: "verbatim-source",
    limitations: [
      "Lexical and syntactic micro-signals establish structural framing, not internal subjective intent by themselves.",
    ],
    locations: decompilation.units.map((u) => ({
      kind: "unit-span",
      unit_id: u.unit_id,
      start: u.span.start,
      end: u.span.end,
    })),
  });

  // Step 2: Mandatory Expounding Obligation Ledger
  const obligationLedger = buildObligationLedger(subject, decompilation, decompEvidence.evidence_id);
  const oblEvidence = createEvidence({
    subject,
    provider: { id: "rel-obligation-engine", name: "REL Obligation Generator", version: "1.0.0" },
    predicateType: "rel.obligation-ledger",
    operation: "build_logic_obligation_ledger",
    parameters: { ledger_id: obligationLedger.ledger_id },
    normalizedResult: {
      ledger_id: obligationLedger.ledger_id,
      total_obligations: obligationLedger.total_obligations,
      sentence_obligations: obligationLedger.sentence_obligations,
      omission_obligations: obligationLedger.omission_obligations,
    },
    confidence: "derived",
    authority: "structural-pragmatics",
    evidenceLinks: [decompEvidence.evidence_id],
  });

  // Step 3: Deep Multi-Layer Expounding across all units & omissions
  const exposition = await expoundAllObligations({
    subject,
    rawText,
    decompilation,
    obligationLedger,
    provider: options.provider || "auto",
    effort: options.effort || "high",
    timeoutMs: options.timeoutMs || 120000,
  });

  const expEvidence = createEvidence({
    subject,
    provider: exposition.provider_used,
    predicateType: "rel.exposition",
    operation: "expound_all_obligations",
    parameters: { obligation_ledger_id: obligationLedger.ledger_id },
    normalizedResult: {
      global_architecture: exposition.global_architecture,
      unit_expositions_count: exposition.unit_expositions.length,
      omission_expositions_count: exposition.omission_expositions.length,
    },
    confidence: exposition.confidence,
    authority: exposition.authority,
    limitations: [
      "Motivational stacks and probability weights represent abductive models over textual and situational evidence; verify high-stakes conclusions using the supplied diagnostic probes.",
    ],
    evidenceLinks: [decompEvidence.evidence_id, oblEvidence.evidence_id],
  });

  // Mark obligations fulfilled
  const unitMap = new Map();
  for (const ue of exposition.unit_expositions) unitMap.set(ue.unit_id, ue);
  for (const oe of exposition.omission_expositions) unitMap.set(oe.omission_id, oe);

  for (const obl of obligationLedger.obligations) {
    if (unitMap.has(obl.unit_id)) {
      obl.status = "verified";
      obl.fulfilling_evidence_ids = [expEvidence.evidence_id];
    }
  }

  // Step 4: Completion Ledger (ecl_...)
  const completionLedger = evaluateExpositionCoverage(obligationLedger, unitMap, [
    decompEvidence.evidence_id,
    expEvidence.evidence_id,
  ]);

  const completionEvidence = createEvidence({
    subject,
    provider: { id: "rel-verifier", name: "REL Obligation Coverage Verifier", version: "1.0.0" },
    predicateType: "rel.completion-ledger",
    operation: "evaluate_exposition_coverage",
    parameters: { completion_ledger_id: completionLedger.ledger_id },
    normalizedResult: completionLedger.summary,
    confidence: "derived",
    authority: "structural-pragmatics",
    evidenceLinks: [oblEvidence.evidence_id, expEvidence.evidence_id],
  });

  // Step 5: Residual Unknowns Registry (unk_...)
  const unknowns = (exposition.unresolved_unknowns || []).map((u) =>
    createResidualUnknown({
      question: u.question,
      domain: u.domain || "motivation-disambiguation",
      scopeDigest: subject.digest.sha256,
      severity: u.severity || "high",
      supportingEvidenceIds: [decompEvidence.evidence_id, expEvidence.evidence_id],
      recommendedProbes: u.recommended_probes || [],
      mutationEvidenceIds: [expEvidence.evidence_id],
    })
  );

  return {
    bundle_format: "rel.investigation-bundle.v1",
    created_at: new Date().toISOString(),
    subject,
    raw_text: rawText,
    decompilation,
    obligation_ledger: obligationLedger,
    completion_ledger: completionLedger,
    exposition,
    unknowns,
    evidence_records: [decompEvidence, oblEvidence, expEvidence, completionEvidence],
  };
}

export function verifyInvestigationBundle(bundle) {
  const issues = [];
  if (!bundle || bundle.bundle_format !== "rel.investigation-bundle.v1") {
    return { valid: false, issues: ["Unrecognized bundle_format"] };
  }
  for (const ev of bundle.evidence_records || []) {
    const check = verifyEvidenceIntegrity(ev);
    if (!check.valid) issues.push(check.reason);
  }
  if (!bundle.completion_ledger?.summary?.complete) {
    issues.push("Completion ledger reports incomplete obligation coverage.");
  }
  return {
    valid: issues.length === 0,
    evidence_verified_count: (bundle.evidence_records || []).length,
    completion_ledger_id: bundle.completion_ledger?.ledger_id,
    complete: Boolean(bundle.completion_ledger?.summary?.complete),
    issues,
  };
}

export function runFramingComparison(leftText, rightText, options = {}) {
  const diff = compareFramings(leftText, rightText, options);
  const ev = createEvidence({
    subject: diff.right_subject,
    provider: { id: "rel-comparator", name: "REL Framing & Draft Comparator", version: "1.0.0" },
    predicateType: "rel.comparison",
    operation: "compare_messages_or_framings",
    parameters: {
      left_sha256: diff.left_subject.digest.sha256,
      right_sha256: diff.right_subject.digest.sha256,
    },
    normalizedResult: diff,
    confidence: "derived",
    authority: "structural-pragmatics",
  });
  return { evidence: ev, comparison: diff };
}
