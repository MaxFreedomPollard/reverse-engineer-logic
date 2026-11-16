import {
  compareAsciiStrings,
  digestCanonicalValue,
  prefixedDigest,
  sha256Text,
  uniqueSortedAscii,
} from "./canonicalDigest.mjs";

/**
 * Epistemic Authority & Confidence vocabularies (adapted directly from REA's
 * dist/domain/evidence.js, reconstructionObligationLedgerSchemas.js,
 * evidenceCompletionLedger.js, and residualUnknown.js).
 */
export const VALID_CONFIDENCE = new Set(["observed", "derived", "inferred"]);

export const VALID_AUTHORITY = new Set([
  "verbatim-source",
  "contextual-premise",
  "structural-pragmatics",
  "game-theoretic-model",
  "neural-synthesis",
  "analyst-inference",
]);

export const VALID_OBLIGATION_STATUS = new Set([
  "unowned",
  "characterized",
  "expounded",
  "verified",
  "contradicted",
  "out-of-scope",
]);

export function createSubject(rawText, options = {}) {
  const text = String(rawText ?? "");
  if (!text.trim()) {
    throw new Error("Subject text or situation description must be non-empty.");
  }
  const sha256 = sha256Text(text);
  const kind = options.kind || inferSubjectKind(text, options.context);
  return Object.freeze({
    subject_id: `sub_${sha256}`,
    name: options.name || options.title || `${kind}-input`,
    kind,
    digest: Object.freeze({ sha256 }),
    char_length: text.length,
    context: options.context ? String(options.context).trim() : null,
  });
}

function inferSubjectKind(text, context) {
  const combined = `${text}\n${context || ""}`;
  if (/^(from|to|subject|date):/im.test(text)) return "email-or-memo";
  if (/^\s*([A-Z][a-zA-Z0-9_ ]{1,24}):\s+.+/m.test(text) && (text.match(/^\s*[A-Z][a-zA-Z0-9_ ]{1,24}:\s+/gm) || []).length >= 2) {
    return "multi-party-dialogue";
  }
  if (/\b(shall|hereby|indemnif|liability|termination|party|agreement)\b/i.test(text)) {
    return "contract-or-policy";
  }
  if (/\b(situation|scenario|decided to|moved to|announced|offered|walked away)\b/i.test(combined) && text.length > 180) {
    return "strategic-situation";
  }
  return "message-or-statement";
}

/**
 * Semantic projection committed by an Evidence ID (excludes ephemeral timestamps/paths).
 */
export function evidenceSemanticContent(record) {
  return {
    subject: record.subject
      ? {
          digest: record.subject.digest,
          kind: record.subject.kind,
          context: record.subject.context ?? null,
        }
      : null,
    provider: record.provider,
    predicate_type: record.predicate_type,
    operation: record.operation,
    parameters: record.parameters ?? {},
    normalized_result: record.normalized_result,
    confidence: record.confidence,
    authority: record.authority,
    limitations: record.limitations ?? [],
    locations: record.locations ?? [],
    evidence_links: uniqueSortedAscii(record.evidence_links ?? []),
  };
}

export function computeEvidenceId(recordWithoutId) {
  return prefixedDigest("ev", evidenceSemanticContent(recordWithoutId), "REL.Evidence.v1");
}

export function createEvidence({
  subject = null,
  provider = { id: "rel-core", name: "Reverse Engineer Logic Engine", version: "1.0.0" },
  predicateType = "rel.analysis",
  operation,
  parameters = {},
  normalizedResult,
  confidence = "observed",
  authority = "verbatim-source",
  limitations = [],
  locations = [],
  evidenceLinks = [],
}) {
  if (!VALID_CONFIDENCE.has(confidence)) {
    throw new Error(`Invalid confidence '${confidence}'`);
  }
  if (!VALID_AUTHORITY.has(authority)) {
    throw new Error(`Invalid authority '${authority}'`);
  }
  const base = {
    subject,
    provider,
    predicate_type: predicateType,
    operation,
    parameters,
    normalized_result: normalizedResult,
    confidence,
    authority,
    limitations: [...limitations],
    locations: [...locations],
    evidence_links: uniqueSortedAscii(evidenceLinks),
  };
  const evidence_id = computeEvidenceId(base);
  return Object.freeze({
    evidence_id,
    created_at: new Date().toISOString(),
    ...base,
  });
}

export function verifyEvidenceIntegrity(evidence) {
  if (!evidence || typeof evidence !== "object" || typeof evidence.evidence_id !== "string") {
    return { valid: false, reason: "Missing evidence_id" };
  }
  const expected = computeEvidenceId(evidence);
  if (expected !== evidence.evidence_id) {
    return {
      valid: false,
      reason: `Tampered or mismatched evidence_id: expected ${expected}, got ${evidence.evidence_id}`,
    };
  }
  return { valid: true, evidence_id: expected };
}

/**
 * Build mandatory Expounding Obligation Ledger from decompiled units & omissions.
 * Every sentence, clause pivot, situational factor, and conspicuous omission
 * gets its own obligation ID so zero aspects can be skipped or glossed over.
 */
export function buildObligationLedger(subject, decompilation, sourceEvidenceId) {
  const obligations = [];

  for (const unit of decompilation.units) {
    const reqDimensions = [
      "surface_vs_operational_function",
      "logic_chain_and_hidden_premises",
      "motivational_stack",
      "word_choice_and_counterfactual",
      "competing_hypotheses_and_falsifier",
    ];
    const seed = {
      subject_sha256: subject.digest.sha256,
      unit_id: unit.unit_id,
      kind: unit.kind,
      span: unit.span,
    };
    obligations.push({
      obligation_id: prefixedDigest("obl", seed, "REL.Obligation.v1"),
      unit_id: unit.unit_id,
      unit_kind: unit.kind,
      anchor_text: unit.text,
      span: unit.span,
      required: true,
      required_dimensions: reqDimensions,
      detected_micro_signals: unit.signals.map((s) => s.code),
      status: "unowned",
      fulfilling_evidence_ids: [],
      source_evidence_id: sourceEvidenceId,
    });
  }

  for (const om of decompilation.conspicuous_omissions) {
    const seed = {
      subject_sha256: subject.digest.sha256,
      unit_id: om.omission_id,
      kind: "conspicuous-omission",
      slot: om.slot,
    };
    obligations.push({
      obligation_id: prefixedDigest("obl", seed, "REL.Obligation.v1"),
      unit_id: om.omission_id,
      unit_kind: "conspicuous-omission",
      anchor_text: `[OMISSION: ${om.title}]`,
      span: null,
      required: true,
      required_dimensions: [
        "expected_in_candid_baseline",
        "strategic_benefit_of_silence",
        "motivational_hypotheses",
        "diagnostic_probe",
      ],
      detected_micro_signals: [om.slot],
      status: "unowned",
      fulfilling_evidence_ids: [],
      source_evidence_id: sourceEvidenceId,
    });
  }

  const ledger_id = prefixedDigest(
    "obl_ledger",
    {
      subject_sha256: subject.digest.sha256,
      obligation_ids: obligations.map((o) => o.obligation_id),
    },
    "REL.ObligationLedger.v1"
  );

  return {
    ledger_id,
    subject_sha256: subject.digest.sha256,
    total_obligations: obligations.length,
    sentence_obligations: obligations.filter((o) => o.unit_kind !== "conspicuous-omission").length,
    omission_obligations: obligations.filter((o) => o.unit_kind === "conspicuous-omission").length,
    obligations,
  };
}

/**
 * Evaluate exposition coverage and mint an REA-style Evidence Completion Ledger (ecl_<64hex>).
 */
export function evaluateExpositionCoverage(obligationLedger, unitExpositionsById, expositionEvidenceIds) {
  const records = [];
  const diagnostics = [];

  const evIds = uniqueSortedAscii(expositionEvidenceIds || []);
  for (const obl of obligationLedger.obligations) {
    const exp = unitExpositionsById.get(obl.unit_id);
    if (!exp) {
      records.push({
        claim_id: obl.unit_id,
        obligation_id: obl.obligation_id,
        status: "unknown",
        evidence_ids: [obl.source_evidence_id],
      });
      diagnostics.push({
        unit_id: obl.unit_id,
        code: "missing-unit-exposition",
        message: `Unit ${obl.unit_id} (${obl.anchor_text.slice(0, 60)}) has not been expounded yet.`,
      });
      continue;
    }

    const missingFields = [];
    if (obl.unit_kind === "conspicuous-omission") {
      for (const k of ["why_expected", "strategic_function_of_silence", "hypotheses", "diagnostic_probe"]) {
        if (!exp[k] || (Array.isArray(exp[k]) && exp[k].length === 0)) {
          missingFields.push(k);
        }
      }
    } else {
      for (const k of [
        "literal_surface",
        "operational_function",
        "logic_chain",
        "hidden_premises",
        "motivational_stack",
        "word_choice_forensics",
        "counterfactual_translation",
        "hypotheses",
        "diagnostic_probe",
      ]) {
        if (!exp[k] || (Array.isArray(exp[k]) && exp[k].length === 0)) {
          missingFields.push(k);
        }
      }
    }

    if (missingFields.length > 0) {
      records.push({
        claim_id: obl.unit_id,
        obligation_id: obl.obligation_id,
        status: "truncated",
        evidence_ids: evIds.length ? evIds : [obl.source_evidence_id],
      });
      diagnostics.push({
        unit_id: obl.unit_id,
        code: "incomplete-dimensions",
        message: `Unit ${obl.unit_id} missing required dimensions: ${missingFields.join(", ")}`,
      });
    } else {
      records.push({
        claim_id: obl.unit_id,
        obligation_id: obl.obligation_id,
        status: "pass",
        evidence_ids: evIds.length ? evIds : [obl.source_evidence_id],
      });
    }
  }

  records.sort((a, b) => compareAsciiStrings(a.claim_id, b.claim_id));
  const counts = { pass: 0, fail: 0, unsupported: 0, truncated: 0, unknown: 0 };
  for (const r of records) counts[r.status] += 1;

  const summary = {
    total: records.length,
    ...counts,
    coverage_ratio: records.length ? Number((counts.pass / records.length).toFixed(4)) : 1,
    complete: counts.pass === records.length,
  };

  const ledger_id = prefixedDigest("ecl", { records }, "REL.CompletionLedger.v1");
  return {
    ledger_id,
    records,
    summary,
    diagnostics,
  };
}

/**
 * Versioned Residual Unknown Record (modeled directly on REA's residualUnknown.js).
 */
export function createResidualUnknown({
  question,
  domain = "motivation-disambiguation",
  scopeDigest,
  severity = "high",
  supportingEvidenceIds = [],
  contradictingEvidenceIds = [],
  competingHypotheses = [],
  recommendedProbes = [],
  mutationEvidenceIds = [],
}) {
  const normalizedQuestion = String(question).replace(/\s+/g, " ").trim();
  const unknown_id = prefixedDigest(
    "unk",
    { domain: domain.trim(), question: normalizedQuestion, scope_digest: scopeDigest },
    "REL.UnknownIdentity.v1"
  );
  const recordWithoutDigest = {
    unknown_id,
    revision: 1,
    previous_revision_digest: null,
    scope_digest: scopeDigest,
    question: normalizedQuestion,
    status: "open",
    severity,
    domain: domain.trim(),
    supporting_evidence_ids: uniqueSortedAscii(supportingEvidenceIds),
    contradicting_evidence_ids: uniqueSortedAscii(contradictingEvidenceIds),
    competing_hypotheses: competingHypotheses,
    recommended_probes: recommendedProbes,
    resolution: null,
    mutation_evidence_ids: uniqueSortedAscii(mutationEvidenceIds),
  };
  const revision_digest = digestCanonicalValue(recordWithoutDigest, "REL.UnknownRevision.v1");
  return Object.freeze({
    ...recordWithoutDigest,
    revision_digest,
  });
}

export function updateResidualUnknown(existing, updates, mutationEvidenceId) {
  const nextStatus = updates.status ?? existing.status;
  const nextResolution =
    nextStatus === "resolved"
      ? updates.resolution ?? {
          disposition: "verified",
          rationale: "Resolved by new observed behavioral or contextual evidence.",
          evidence_ids: [mutationEvidenceId],
        }
      : null;

  const nextWithoutDigest = {
    ...existing,
    revision: existing.revision + 1,
    previous_revision_digest: existing.revision_digest,
    status: nextStatus,
    severity: updates.severity ?? existing.severity,
    supporting_evidence_ids: uniqueSortedAscii([
      ...existing.supporting_evidence_ids,
      ...(updates.supportingEvidenceIds ?? []),
    ]),
    contradicting_evidence_ids: uniqueSortedAscii([
      ...existing.contradicting_evidence_ids,
      ...(updates.contradictingEvidenceIds ?? []),
    ]),
    competing_hypotheses: updates.competingHypotheses ?? existing.competing_hypotheses,
    recommended_probes: updates.recommendedProbes ?? existing.recommended_probes,
    resolution: nextResolution,
    mutation_evidence_ids: uniqueSortedAscii([
      ...existing.mutation_evidence_ids,
      ...(mutationEvidenceId ? [mutationEvidenceId] : []),
    ]),
  };
  delete nextWithoutDigest.revision_digest;
  const revision_digest = digestCanonicalValue(nextWithoutDigest, "REL.UnknownRevision.v1");
  return Object.freeze({
    ...nextWithoutDigest,
    revision_digest,
  });
}
