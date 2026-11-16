// Auto-generated JavaScriptCore bundle for Reverse Engineer Logic macOS Universal App & Native CLI/MCP
// Uses native CryptoKit SHA-256 injected as globalThis.__relSha256Hex(str).

function canonicalJson(value, contextLabel = "Canonical value") {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) throw new TypeError(contextLabel + " non-finite");
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map((item, idx) => item === undefined ? "null" : canonicalJson(item, contextLabel + "[" + idx + "]")).join(",") + "]";
  }
  if (t === "object") {
    const keys = Object.keys(value).filter(k => value[k] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(value[k], contextLabel + "." + k)).join(",") + "}";
  }
  throw new TypeError(contextLabel + " unsupported type: " + t);
}

function sha256Text(text) {
  return globalThis.__relSha256Hex(String(text));
}

function digestCanonicalValue(value, domainTag = "REL") {
  return globalThis.__relSha256Hex(domainTag + "\u0000" + canonicalJson(value, domainTag));
}

function prefixedDigest(prefix, value, domainTag) {
  return prefix + "_" + digestCanonicalValue(value, domainTag);
}

function compareAsciiStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function uniqueSortedAscii(items) {
  return [...new Set(items)].sort(compareAsciiStrings);
}


/**
 * Epistemic Authority & Confidence vocabularies (adapted directly from REA's
 * dist/domain/evidence.js, reconstructionObligationLedgerSchemas.js,
 * evidenceCompletionLedger.js, and residualUnknown.js).
 */
const VALID_CONFIDENCE = new Set(["observed", "derived", "inferred"]);
const VALID_AUTHORITY = new Set([
  "verbatim-source",
  "contextual-premise",
  "structural-pragmatics",
  "game-theoretic-model",
  "neural-synthesis",
  "analyst-inference",
]);
const VALID_OBLIGATION_STATUS = new Set([
  "unowned",
  "characterized",
  "expounded",
  "verified",
  "contradicted",
  "out-of-scope",
]);
function createSubject(rawText, options = {}) {
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
function evidenceSemanticContent(record) {
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
function computeEvidenceId(recordWithoutId) {
  return prefixedDigest("ev", evidenceSemanticContent(recordWithoutId), "REL.Evidence.v1");
}
function createEvidence({
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
function verifyEvidenceIntegrity(evidence) {
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
function buildObligationLedger(subject, decompilation, sourceEvidenceId) {
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
function evaluateExpositionCoverage(obligationLedger, unitExpositionsById, expositionEvidenceIds) {
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
function createResidualUnknown({
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
function updateResidualUnknown(existing, updates, mutationEvidenceId) {
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


/**
 * Deterministic Pragmatic, Rhetorical, Deontic & Situational Decompiler.
 *
 * Just as REA's static disassembler recovers instructions, basic blocks, control-flow
 * pivots, xrefs, and imported capabilities before high-level reasoning begins, this
 * engine disassembles raw prose, dialogues, contracts, or situational descriptions into:
 *   1. Addressable Units (S1..Sn) with exact [start, end] character coordinates & speakers
 *   2. Sub-Clauses & Adversative Pivots ("X, but Y" -> pre-pivot anesthetic vs. post-pivot payload)
 *   3. 16 Linguistic / Pragmatic / Strategic Micro-Signal Classes with exact match spans
 *   4. Speech-Act Taxonomy (Assertive, Directive, Commissive, Expressive, Declarative)
 *   5. Commitment Symmetry & Agency Attribution Metrics
 *   6. Conspicuous Omission Slots (OM1..OMk) for what a candid baseline would have included
 */

const MICRO_SIGNAL_RULES = [
  {
    code: "ADVERSATIVE_PIVOT",
    label: "Adversative Pivot (Pre-Pivot Cushion -> Post-Pivot Payload)",
    category: "framing-pivot",
    regex: /\b(but|however|that said|having said that|at the same time|nevertheless|nonetheless|yet|though|although|even though|while)\b/gi,
    mechanic:
      "Splits the sentence into a face-saving or rapport-preserving concession before the pivot and the speaker's actual operational priority after the pivot.",
  },
  {
    code: "PASSIVE_AGENCY_ERASURE",
    label: "Passive Voice / Agency Erasure",
    category: "accountability-shift",
    regex: /\b(mistakes were made|it was decided|was delayed|were missed|has been determined|was overlooked|occurred|happened to be|ended up being|things got)\b/gi,
    mechanic:
      "Grammatically deletes the causal human decision-maker so an unpopular choice or failure reads like impersonal weather rather than an attributable action.",
  },
  {
    code: "EPISTEMIC_HEDGE",
    label: "Epistemic Hedge / Plausible Deniability",
    category: "optionality-preservation",
    regex: /\b(might|may|perhaps|possibly|arguably|seemingly|appears to|as far as I know|to my knowledge|if I recall|my sense is|sort of|kind of|believe|feel like)\b/gi,
    mechanic:
      "Lowers truth-commitment cost so the actor can advance a claim or insinuation today while retaining an exit ramp if challenged tomorrow.",
  },
  {
    code: "VAGUE_COMMITMENT_HORIZON",
    label: "Non-Binding / Elastic Commitment",
    category: "commitment-asymmetry",
    regex: /\b(soon|at some point|circle back|touch base|explore|look into|try to|aim to|hope to|in principle|down the road|when bandwidth allows|keep in mind|revisit)\b/gi,
    mechanic:
      "Simulates forward motion and goodwill while binding zero calendar dates, deliverables, or enforceable obligations.",
  },
  {
    code: "HARD_DEONTIC_PRESSURE",
    label: "Deontic Obligation / Boundary Enforcement",
    category: "power-and-leverage",
    regex: /\b(must|need you to|have to|required|mandatory|non-negotiable|cannot|will not|expect you to|essential that|critical that)\b/gi,
    mechanic:
      "Projects high authority or immovable constraint to narrow the counterpart's perceived action space.",
  },
  {
    code: "EXTERNALIZED_BLOCKER",
    label: "Externalized Authority / Bad-Cop Shield",
    category: "power-and-leverage",
    regex: /\b(policy|legal|compliance|the board|leadership|finance|committee|hands are tied|above my pay grade|standard procedure|protocol requires|the system won't)\b/gi,
    mechanic:
      "Preserves interpersonal warmth ('I am on your side') while attributing a refusal or concession demand to an unreachable off-stage entity.",
  },
  {
    code: "PRESUPPOSITION_TRIGGER",
    label: "Smuggled Presupposition",
    category: "hidden-premise",
    regex: /\b(realize that|aware that|stop|again|still|finally|even|obviously|clearly|of course|naturally|as you know|given that)\b/gi,
    mechanic:
      "Packages a contested assumption as background common knowledge rather than an open claim, forcing the listener to either challenge the frame explicitly or swallow the premise.",
  },
  {
    code: "PREEMPTIVE_INOCULATION",
    label: "Pre-emptive Self-Inoculation / Confession Shield",
    category: "defensive-framing",
    regex: /\b(with all due respect|not to be|don't get me wrong|to be honest|to be transparent|frankly|candidly|hate to ask|no offense|just between us|in fullcandor)\b/gi,
    mechanic:
      "Reveals the exact negative inference the speaker predicts the listener is about to draw (disrespect, dishonesty, intrusion, manipulation) and attempts to pre-cancel it.",
  },
  {
    code: "STRATEGIC_ESCAPE_HATCH",
    label: "Discretionary Escape Clause",
    category: "optionality-preservation",
    regex: /\b(subject to|at our discretion|if appropriate|where feasible|commercially reasonable|as needed|barring unforeseen|pending review|materially)\b/gi,
    mechanic:
      "Embeds a subjective unilateral condition inside an apparent agreement so the drafter controls whether performance ever triggers.",
  },
  {
    code: "URGENCY_COMPRESSION",
    label: "Deliberation-Window Compression / Scarcity",
    category: "tempo-control",
    regex: /\b(immediately|asap|by eod|end of day|right now|urgent|time-sensitive|closing soon|other interested|limited window|before Friday|today only)\b/gi,
    mechanic:
      "Shrinks the counterpart's time to verify facts, consult allies, or develop BATNA alternatives.",
  },
  {
    code: "CONDITIONAL_QUID_PRO_QUO",
    label: "Conditional Gate / Leverage Coupling",
    category: "bargaining-structure",
    regex: /\b(if|unless|provided that|once|as soon as|in exchange for|contingent on|assuming|only when)\b/gi,
    mechanic:
      "Links a desired outcome to a prerequisite concession, revealing the speaker's true exchange function.",
  },
  {
    code: "UNIVERSAL_QUANTIFIER_ANCHOR",
    label: "Absolute / Extreme-Case Formulation",
    category: "anchoring",
    regex: /\b(always|never|everyone|nobody|every single|completely|impossible|zero|100%|entirely|only way)\b/gi,
    mechanic:
      "Overstates invariance to anchor negotiations or justify a disproportionate reaction, often vulnerable to a single counterexample.",
  },
  {
    code: "MINIMIZER_DIMINISHER",
    label: "Cost / Ask Minimizer",
    category: "ask-softening",
    regex: /\b(just|simply|quick|small|tiny|minor|only|5 minutes|briefly|real quick|tweaking)\b/gi,
    mechanic:
      "Frames a non-trivial request, concession, or risk transfer as frictionless so refusal looks unreasonable or petty.",
  },
  {
    code: "WE_ALIGNMENT_MERGE",
    label: "Synthetic 'We' Coalition Framing",
    category: "coalition-signaling",
    regex: /\b(we both|our shared|together|partnership|aligned|on the same page|mutually|for both of us|team effort)\b/gi,
    mechanic:
      "Blurs distinct self-interests into a single collective identity, either to build genuine cooperation or to socialize private costs.",
  },
  {
    code: "CAUSAL_JUSTIFICATION_BECAUSE",
    label: "Explicit Reason-Giving ('Because' Trigger)",
    category: "logic-connector",
    regex: /\b(because|since|therefore|thus|consequently|as a result|that's why|for this reason|so that|in order to)\b/gi,
    mechanic:
      "Exposes the stated warrant connecting premise to conclusion, allowing direct audit of whether the stated reason actually entails the move.",
  },
  {
    code: "NUMERIC_OR_TEMPORAL_ANCHOR",
    label: "Concrete Quantitative / Date Anchor",
    category: "hard-specification",
    regex: /(\$\s?\d[\d,.]*|\b\d+(?:\.\d+)?%|\b\d+\s*(?:days?|hours?|weeks?|months?|years?|x|k|m|b)\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b)/gi,
    mechanic:
      "Introduces hard falsifiable coordinates (price, percentage, deadline) that anchor bargaining space or expose asymmetry against vague surrounding promises.",
  },
];

const ABBREVIATIONS = new Set([
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "vs.", "etc.", "e.g.", "i.e.",
  "inc.", "ltd.", "co.", "corp.", "st.", "no.", "fig.", "vol.", "jan.", "feb.", "mar.",
  "apr.", "aug.", "sep.", "sept.", "oct.", "nov.", "dec.", "u.s.", "u.k.",
]);

/**
 * Segment arbitrary text into paragraphs and exact character-offset sentences/units.
 */
function segmentIntoUnits(rawText) {
  const text = String(rawText ?? "");
  const units = [];
  const paraRegex = /[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g;
  let paraMatch;
  let paraIndex = 0;
  let unitCounter = 0;

  while ((paraMatch = paraRegex.exec(text)) !== null) {
    paraIndex += 1;
    const pText = paraMatch[0];
    const pStart = paraMatch.index;

    // Split paragraph into sentences while preserving exact offsets and respecting abbreviations/decimals
    const sentenceSpans = splitParagraphIntoSentences(pText, pStart);
    for (const sp of sentenceSpans) {
      unitCounter += 1;
      const unitId = `S${String(unitCounter).padStart(2, "0")}`;
      const speakerMatch = sp.text.match(/^\s*([A-Z][A-Za-z0-9_ .-]{0,26}):\s+([\s\S]+)$/);
      const speaker = speakerMatch ? speakerMatch[1].trim() : null;
      const bodyText = speakerMatch ? speakerMatch[2] : sp.text;

      const signals = scanMicroSignals(sp.text, sp.start);
      const clauses = splitClauses(bodyText);
      const speechActs = classifySpeechActs(bodyText, signals);
      const agency = analyzeAgencyAndCommitment(bodyText, signals);

      units.push({
        unit_id: unitId,
        paragraph_index: paraIndex,
        sentence_index: unitCounter,
        kind: inferUnitKind(sp.text, speaker),
        speaker,
        text: sp.text,
        span: { start: sp.start, end: sp.end },
        word_count: sp.text.trim().split(/\s+/).filter(Boolean).length,
        clauses,
        speech_acts: speechActs,
        agency_and_commitment: agency,
        signals,
      });
    }
  }

  return units;
}

function splitParagraphIntoSentences(pText, baseOffset) {
  const results = [];
  // Handle bullet lists cleanly: if a paragraph has multiple bullet lines, treat each bullet line as its own unit
  const lines = pText.split("\n");
  if (lines.length > 1 && lines.filter((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l)).length >= 2) {
    let cursor = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        const lead = line.indexOf(trimmed);
        results.push({
          text: trimmed,
          start: baseOffset + cursor + lead,
          end: baseOffset + cursor + lead + trimmed.length,
        });
      }
      cursor += line.length + 1;
    }
    return results;
  }

  let start = 0;
  for (let i = 0; i < pText.length; i += 1) {
    const ch = pText[i];
    if (ch === "." || ch === "!" || ch === "?") {
      // Skip decimals like 3.14 or v1.2
      if (ch === "." && i > 0 && /\d/.test(pText[i - 1]) && i + 1 < pText.length && /\d/.test(pText[i + 1])) {
        continue;
      }
      // Check ellipses ...
      if (ch === "." && pText[i + 1] === ".") {
        while (pText[i + 1] === ".") i += 1;
      }
      // Check common abbreviations
      const wordBefore = pText.slice(Math.max(0, i - 10), i + 1).split(/\s+/).pop().toLowerCase();
      if (ABBREVIATIONS.has(wordBefore)) {
        continue;
      }
      // Look ahead for whitespace + capital/quote/end
      let endIdx = i + 1;
      while (endIdx < pText.length && /["')\]}]/.test(pText[endIdx])) {
        endIdx += 1;
      }
      if (endIdx === pText.length || /\s/.test(pText[endIdx])) {
        const nextNonSpace = pText.slice(endIdx).match(/\S/);
        if (endIdx === pText.length || (nextNonSpace && /[A-Z0-9"(\[-•*]/.test(nextNonSpace[0]))) {
          const slice = pText.slice(start, endIdx);
          const trimmed = slice.trim();
          if (trimmed) {
            const lead = slice.indexOf(trimmed);
            results.push({
              text: trimmed,
              start: baseOffset + start + lead,
              end: baseOffset + start + lead + trimmed.length,
            });
          }
          start = endIdx;
        }
      }
    }
  }

  if (start < pText.length) {
    const tail = pText.slice(start);
    const trimmed = tail.trim();
    if (trimmed) {
      const lead = tail.indexOf(trimmed);
      results.push({
        text: trimmed,
        start: baseOffset + start + lead,
        end: baseOffset + start + lead + trimmed.length,
      });
    }
  }
  return results;
}

function inferUnitKind(text, speaker) {
  if (/^(subject|re|from|to|date):/i.test(text)) return "header-metadata";
  if (/^\s*(?:[-*•]|\d+[.)])\s+/.test(text)) return "enumerated-item";
  if (speaker) return "dialogue-turn";
  if (/\?["')\]]*$/.test(text.trim())) return "interrogative-move";
  return "statement-unit";
}

function scanMicroSignals(unitText, unitStart) {
  const hits = [];
  for (const rule of MICRO_SIGNAL_RULES) {
    rule.regex.lastIndex = 0;
    let m;
    while ((m = rule.regex.exec(unitText)) !== null) {
      hits.push({
        code: rule.code,
        label: rule.label,
        category: rule.category,
        match: m[0],
        span: {
          start: unitStart + m.index,
          end: unitStart + m.index + m[0].length,
        },
        mechanic: rule.mechanic,
      });
    }
  }
  hits.sort((a, b) => a.span.start - b.span.start);
  return hits;
}

function splitClauses(text) {
  const pivotRegex = /\b(but|however|although|though|even though|while|whereas|unless|if|because|since|so that|therefore)\b/i;
  const m = pivotRegex.exec(text);
  if (!m || m.index < 6 || m.index > text.length - 6) {
    return [{ role: "primary-nucleus", connector: null, text: text.trim() }];
  }
  const left = text.slice(0, m.index).replace(/[,;:\s]+$/, "").trim();
  const connector = m[0];
  const right = text.slice(m.index).trim();
  const lowerConn = connector.toLowerCase();
  const isAdversative = ["but", "however", "although", "though", "even though", "while", "whereas"].includes(lowerConn);

  return [
    {
      role: isAdversative ? "pre-pivot-concession-or-cushion" : "antecedent-or-main-clause",
      connector: null,
      text: left,
    },
    {
      role: isAdversative ? "post-pivot-operational-payload" : "subordinate-condition-or-warrant",
      connector,
      text: right,
    },
  ];
}

function classifySpeechActs(text, signals) {
  const acts = [];
  const trimmed = text.trim();
  const codes = new Set(signals.map((s) => s.code));

  if (/\?["')\]]*$/.test(trimmed) || /\b(please|could you|would you|can you|let me know|send over|share|confirm)\b/i.test(trimmed) || codes.has("HARD_DEONTIC_PRESSURE")) {
    acts.push("directive-ask-or-probe");
  }
  if (/\b(I will|we will|I'll|we'll|commit|promise|guarantee|ensure|happy to|plan to|going to)\b/i.test(trimmed) || codes.has("VAGUE_COMMITMENT_HORIZON")) {
    acts.push("commissive-promise-or-punt");
  }
  if (/\b(thank|appreciate|excited|glad|sorry|apologize|great|love|respect|value|understand)\b/i.test(trimmed)) {
    acts.push("expressive-rapport-or-facework");
  }
  if (/\b(effective immediately|hereby|terminated|approved|rejected|decided to|moving forward with|declining)\b/i.test(trimmed)) {
    acts.push("declarative-boundary-shift");
  }
  if (acts.length === 0 || /\b(is|are|was|were|has|have|shows|means)\b/i.test(trimmed)) {
    acts.push("assertive-framing-claim");
  }
  return acts;
}

function analyzeAgencyAndCommitment(text, signals) {
  const firstPerson = (text.match(/\b(I|me|my|mine)\b/g) || []).length;
  const collectiveWe = (text.match(/\b(we|us|our|ours)\b/gi) || []).length;
  const secondPerson = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  const codes = new Set(signals.map((s) => s.code));

  let commitmentStrength = "neutral";
  if (codes.has("NUMERIC_OR_TEMPORAL_ANCHOR") && /\b(I will|we will|guarantee|commit|deliver by)\b/i.test(text) && !codes.has("EPISTEMIC_HEDGE") && !codes.has("STRATEGIC_ESCAPE_HATCH")) {
    commitmentStrength = "hard-binding";
  } else if (codes.has("VAGUE_COMMITMENT_HORIZON") || codes.has("STRATEGIC_ESCAPE_HATCH") || codes.has("EPISTEMIC_HEDGE")) {
    commitmentStrength = "soft-nonbinding-optionality";
  } else if (codes.has("HARD_DEONTIC_PRESSURE") && secondPerson > 0) {
    commitmentStrength = "outbound-obligation-on-counterpart";
  }

  return {
    first_person_singular_count: firstPerson,
    collective_we_count: collectiveWe,
    second_person_target_count: secondPerson,
    passive_erasure: codes.has("PASSIVE_AGENCY_ERASURE"),
    commitment_profile: commitmentStrength,
  };
}

/**
 * Detect conspicuous omissions (what a candid, non-strategic baseline would include,
 * but this message or situation conspicuously leaves out).
 */
function detectConspicuousOmissions(rawText, units, contextText = "") {
  const omissions = [];
  const allCodes = new Set(units.flatMap((u) => u.signals.map((s) => s.code)));
  const full = `${rawText}\n${contextText}`;

  // 1. Vague promises or asks without concrete dates/metrics
  const hasVague = allCodes.has("VAGUE_COMMITMENT_HORIZON") || allCodes.has("STRATEGIC_ESCAPE_HATCH");
  const hasConcreteNumbers = allCodes.has("NUMERIC_OR_TEMPORAL_ANCHOR");
  if (hasVague || (!hasConcreteNumbers && units.some((u) => u.speech_acts.includes("commissive-promise-or-punt")))) {
    omissions.push({
      omission_id: `OM${String(omissions.length + 1).padStart(2, "0")}`,
      slot: "MISSING_CONCRETE_VERIFIABLE_HORIZON",
      title: "Absence of Concrete Dates, Metrics, or Acceptance Criteria",
      trigger_observation:
        "Commitments or next steps are framed using elastic horizons ('soon', 'explore', 'when bandwidth allows', or unanchored future verbs) without a falsifiable deadline or numeric threshold.",
    });
  }

  // 2. Passive voice or externalized blocker hiding the actual decision-maker
  if (allCodes.has("PASSIVE_AGENCY_ERASURE") || allCodes.has("EXTERNALIZED_BLOCKER")) {
    omissions.push({
      omission_id: `OM${String(omissions.length + 1).padStart(2, "0")}`,
      slot: "MISSING_DECISION_OWNER_AND_INCENTIVE",
      title: "Omitted Named Decision-Maker & Real Internal Tradeoff",
      trigger_observation:
        "Refusals, delays, or constraints are attributed to passive events or impersonal entities ('policy', 'bandwidth', 'it was decided') while omitting who actually holds veto power and what would change their vote.",
    });
  }

  // 3. Asymmetric ask: outbound pressure on 'you' without reciprocal 'I/we' commitment
  const outboundAsks = units.filter(
    (u) => u.speech_acts.includes("directive-ask-or-probe") || u.agency_and_commitment.second_person_target_count > 0
  );
  const hardSelfCommits = units.filter((u) => u.agency_and_commitment.commitment_profile === "hard-binding");
  if (outboundAsks.length > 0 && hardSelfCommits.length === 0) {
    omissions.push({
      omission_id: `OM${String(omissions.length + 1).padStart(2, "0")}`,
      slot: "MISSING_RECIPROCAL_DOWNSIDE_OR_CONCESSION",
      title: "One-Way Risk/Effort Ask Without Reciprocal Binding Commitment",
      trigger_observation:
        "The actor requests information, action, concession, or patience from the counterpart while keeping their own reciprocal commitment non-binding or unstated.",
    });
  }

  // 4. Unstated BATNA / Consequences of saying No (always relevant in strategic situations & messages)
  if (omissions.length === 0 || /\b(offer|propos|deal|decid|negoti|situat|messag|ask|wait|change|price|role|team)\b/i.test(full)) {
    omissions.push({
      omission_id: `OM${String(omissions.length + 1).padStart(2, "0")}`,
      slot: "OMITTED_TRUE_BATNA_AND_WALKAWAY_COST",
      title: "Unstated Fallback Position (BATNA) & Cost of Non-Agreement",
      trigger_observation:
        "Every strategic move or message conceals the actor's true walk-away threshold and which failure mode they privately fear most.",
    });
  }

  return omissions;
}

/**
 * Full deterministic decompilation pass over a message or situation.
 */
function decompileSubject(subject, rawText) {
  const units = segmentIntoUnits(rawText);
  const conspicuous_omissions = detectConspicuousOmissions(rawText, units, subject.context || "");

  const signalCounts = {};
  for (const u of units) {
    for (const s of u.signals) {
      signalCounts[s.code] = (signalCounts[s.code] || 0) + 1;
    }
  }

  const speakers = [...new Set(units.map((u) => u.speaker).filter(Boolean))];
  const adversativeUnits = units.filter((u) => u.signals.some((s) => s.code === "ADVERSATIVE_PIVOT")).map((u) => u.unit_id);
  const hedgedUnits = units.filter((u) => u.signals.some((s) => s.code === "EPISTEMIC_HEDGE")).map((u) => u.unit_id);

  return {
    subject_id: subject.subject_id,
    subject_kind: subject.kind,
    statistics: {
      unit_count: units.length,
      omission_count: conspicuous_omissions.length,
      total_obligations_generated: units.length + conspicuous_omissions.length,
      total_micro_signals: Object.values(signalCounts).reduce((a, b) => a + b, 0),
      signal_histogram: signalCounts,
      detected_speakers: speakers,
      adversative_pivot_units: adversativeUnits,
      hedged_units: hedgedUnits,
    },
    units,
    conspicuous_omissions,
  };
}




/**
 * Compare two messages, drafts, or situational framings (modeled on REA's
 * compare_functions & find_changed_behavior).
 * Pinpoints walked-back commitments, newly injected hedges, shifted agency/blame,
 * and altered leverage between Left (Baseline/V1) and Right (Revised/V2).
 */
function compareFramings(leftText, rightText, options = {}) {
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


function buildExpoundingPrompt(subject, rawText, decompilation, obligationLedger) {
  const unitList = decompilation.units.map((u) => ({
    unit_id: u.unit_id,
    speaker: u.speaker,
    text: u.text,
    clauses: u.clauses,
    speech_acts: u.speech_acts,
    detected_signals: u.signals.map((s) => `${s.code} ("${s.match}")`),
  }));

  const omissionList = decompilation.conspicuous_omissions.map((o) => ({
    omission_id: o.omission_id,
    slot: o.slot,
    title: o.title,
    trigger_observation: o.trigger_observation,
  }));

  return [
    "CRITICAL EXECUTION RULE: Do NOT call any tools whatsoever. Respond immediately on your very first turn with ONLY a single valid JSON object.",
    "You are Reverse Engineer Logic (REL), an epistemic, rhetorical, game-theoretic, and motivational decompiler modeled on binary reverse-engineering rigor.",
    "Analyze the supplied message or situation and expound DEEPLY, candidly, and incisively upon the exact logic, hidden premises, incentive geometry, word-choice micro-signals, and layered motivations behind EVERY SINGLE unit_id and omission_id.",
    "Rules:",
    "1. NEVER use em-dashes in any string; use colons, semicolons, parentheses, or standard hyphens.",
    "2. Strip away all social anesthetic: explain what work each phrase, ordering, hedge, framing, or move is actually doing, what alternative phrasing was rejected, and what real-world incentive or fear drives it.",
    "3. Maintain epistemic rigor: provide competing motivational hypotheses with realistic probability weights summing to 1.0 (e.g. 0.60, 0.25, 0.15) and concrete falsification probes (exact questions or tests whose answer separates H1 from H2).",
    "4. Cover EVERY unit_id in Units and EVERY omission_id in ConspicuousOmissions without skipping a single one.",
    "5. Return ONLY a single valid JSON object with keys: global_architecture, unit_expositions, omission_expositions, unresolved_unknowns.",
    "",
    `=== SUBJECT METADATA ===`,
    `Kind: ${subject.kind} | Obligations: ${obligationLedger.total_obligations}`,
    subject.context ? `Situational Context: ${subject.context}` : `Situational Context: (Infer from text)`,
    "",
    `=== RAW INPUT ===`,
    rawText,
    "",
    `=== DECOMPILED UNITS (MUST EXPOUND ALL ${unitList.length}) ===`,
    JSON.stringify(unitList, null, 2),
    "",
    `=== CONSPICUOUS OMISSIONS (MUST EXPOUND ALL ${omissionList.length}) ===`,
    JSON.stringify(omissionList, null, 2),
  ].join("\n");
}



function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  if (!text) throw new Error("Provider returned empty output.");

  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object") {
      if (direct.structured_output && typeof direct.structured_output === "object") {
        return sanitizeNoEmDash(direct.structured_output);
      }
      if (typeof direct.result === "string" && direct.result.trim()) {
        return extractJsonObject(direct.result);
      }
      if (typeof direct.response === "string" && direct.response.trim()) {
        return extractJsonObject(direct.response);
      }
      if (direct.global_architecture || direct.unit_expositions) {
        return sanitizeNoEmDash(direct);
      }
      throw new Error(`Envelope status=${direct.status || "unknown"} without structured_output`);
    }
  } catch (e) {
    if (String(e.message).startsWith("Envelope status=")) throw e;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("Provider output did not contain a JSON object.");
  }
  const cleaned = candidate.slice(firstBrace, lastBrace + 1).replace(/\u2014/g, " - ");
  return sanitizeNoEmDash(JSON.parse(cleaned));
}

function sanitizeNoEmDash(obj) {
  if (typeof obj === "string") return obj.replace(/\u2014/g, " - ");
  if (Array.isArray(obj)) return obj.map(sanitizeNoEmDash);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = sanitizeNoEmDash(v);
    return out;
  }
  return obj;
}

function mergeAndGuaranteeCoverage(parsed, fallback, decompilation) {
  const clean = sanitizeNoEmDash(parsed || {});
  const byUnit = new Map();
  for (const fb of fallback.unit_expositions) byUnit.set(fb.unit_id, fb);

  if (Array.isArray(clean.unit_expositions)) {
    for (const item of clean.unit_expositions) {
      if (item && item.unit_id && byUnit.has(item.unit_id)) {
        const fb = byUnit.get(item.unit_id);
        byUnit.set(item.unit_id, {
          unit_id: item.unit_id,
          literal_surface: item.literal_surface || fb.literal_surface,
          operational_function: item.operational_function || fb.operational_function,
          logic_chain: Array.isArray(item.logic_chain) && item.logic_chain.length ? item.logic_chain : fb.logic_chain,
          hidden_premises:
            Array.isArray(item.hidden_premises) && item.hidden_premises.length
              ? item.hidden_premises
              : fb.hidden_premises,
          motivational_stack: {
            ...fb.motivational_stack,
            ...(item.motivational_stack || {}),
          },
          word_choice_forensics: item.word_choice_forensics || fb.word_choice_forensics,
          counterfactual_translation: item.counterfactual_translation || fb.counterfactual_translation,
          hypotheses: Array.isArray(item.hypotheses) && item.hypotheses.length ? item.hypotheses : fb.hypotheses,
          diagnostic_probe: item.diagnostic_probe || fb.diagnostic_probe,
        });
      }
    }
  }

  const byOm = new Map();
  for (const fb of fallback.omission_expositions) byOm.set(fb.omission_id, fb);
  if (Array.isArray(clean.omission_expositions)) {
    for (const item of clean.omission_expositions) {
      if (item && item.omission_id && byOm.has(item.omission_id)) {
        const fb = byOm.get(item.omission_id);
        byOm.set(item.omission_id, {
          omission_id: item.omission_id,
          why_expected: item.why_expected || fb.why_expected,
          strategic_function_of_silence:
            item.strategic_function_of_silence || fb.strategic_function_of_silence,
          hypotheses: Array.isArray(item.hypotheses) && item.hypotheses.length ? item.hypotheses : fb.hypotheses,
          diagnostic_probe: item.diagnostic_probe || fb.diagnostic_probe,
        });
      }
    }
  }

  return {
    global_architecture: {
      ...fallback.global_architecture,
      ...(clean.global_architecture || {}),
    },
    unit_expositions: decompilation.units.map((u) => byUnit.get(u.unit_id)),
    omission_expositions: decompilation.conspicuous_omissions.map((o) => byOm.get(o.omission_id)),
    unresolved_unknowns:
      Array.isArray(clean.unresolved_unknowns) && clean.unresolved_unknowns.length
        ? clean.unresolved_unknowns
        : fallback.unresolved_unknowns,
  };
}
function buildDeterministicDeepExposition(subject, rawText, decompilation) {
  const units = decompilation.units;
  const omissions = decompilation.conspicuous_omissions;
  const hist = decompilation.statistics.signal_histogram;

  const unit_expositions = units.map((u, idx) => synthesizeUnitDossier(u, idx, units.length, subject));
  const omission_expositions = omissions.map((o) => synthesizeOmissionDossier(o, subject));

  const dominantPatterns = Object.entries(hist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, count]) => `${code} (${count}x)`);

  const hasPivots = (hist.ADVERSATIVE_PIVOT || 0) > 0;
  const hasVague = (hist.VAGUE_COMMITMENT_HORIZON || 0) > 0 || (hist.STRATEGIC_ESCAPE_HATCH || 0) > 0;
  const hasExternal = (hist.EXTERNALIZED_BLOCKER || 0) > 0 || (hist.PASSIVE_AGENCY_ERASURE || 0) > 0;

  const subtextParts = [];
  subtextParts.push(
    `Across ${units.length} addressable units and ${omissions.length} conspicuous omissions, this ${subject.kind} is structured to advance a specific positional outcome while minimizing the actor's interpersonal friction and binding downside.`
  );
  if (hasPivots) {
    subtextParts.push(
      `Adversative pivots (${decompilation.statistics.adversative_pivot_units.join(", ")}) reveal a classic two-stage framing: initial warmth or validation is deployed as social anesthetic so the post-pivot constraint, refusal, or ask lands without triggering defensive pushback.`
    );
  }
  if (hasVague) {
    subtextParts.push(
      `Notice the commitment asymmetry: where concrete concessions, patience, or actions are sought from the counterpart, the speaker's own future obligations remain protected behind elastic horizons or discretionary escape clauses.`
    );
  }
  if (hasExternal) {
    subtextParts.push(
      `Accountability for friction points is deflected away from the speaker via passive agency erasure or off-stage authorities ('policy', 'bandwidth', 'process'), allowing the speaker to preserve rapport while holding a firm line.`
    );
  }

  const speakers = decompilation.statistics.detected_speakers.length
    ? decompilation.statistics.detected_speakers
    : ["Primary Initiator / Speaker", "Target Counterpart / Audience"];

  const actor_incentive_matrix = speakers.map((sp, i) => ({
    actor: sp,
    stated_goal:
      i === 0
        ? "Maintain constructive alignment, communicate current status/constraints, and coordinate next steps smoothly."
        : "Obtain clarity, fair reciprocity, predictable commitments, and protection against downside risk.",
    revealed_incentives:
      i === 0
        ? "Maximize optionality, extract clarity or patience from the counterpart at near-zero binding cost, and keep exit ramps open until higher-priority contingencies resolve."
        : "Convert soft promises into falsifiable dates/numbers and surface the real decision-maker before expending scarce effort or leverage.",
    core_fears_or_aversions:
      i === 0
        ? "Being locked into an irreversible commitment too early, taking direct personal blame for a refusal/delay, or losing the counterpart as a warm backup option."
        : "Investing resources into an asymmetric arrangement, absorbing hidden risk, or mistaking polite deferrals for genuine buy-in.",
    leverage_and_batna:
      i === 0
        ? "Controls information timing and internal process visibility; relies on ambiguity so the counterpart underestimates their own leverage."
        : "Controls cooperation, execution bandwidth, and willingness to walk away or escalate to decision-owning principals.",
  }));

  const unresolved_unknowns = [
    {
      question:
        "Are the stated constraints and elastic timelines driven by genuine internal capacity limits, or by an unstated higher-priority alternative (BATNA hedging)?",
      severity: "high",
      domain: "motivation-disambiguation",
      recommended_probes: [
        {
          operation:
            "Offer a concrete, zero-friction narrowing of scope tied to a specific calendar date (e.g., 'If we scope this strictly to X, can we lock Tuesday at 2 PM to sign off?').",
          rationale:
            "Genuine bandwidth constraints accept narrower scope gratefully; optionality-hedgers invent a second unrelated blocker once the first blocker is solved.",
        },
      ],
    },
    {
      question:
        "Does the speaker personally hold decision authority here, or are they acting as an intermediary buffering an unconvinced principal?",
      severity: hasExternal ? "critical" : "medium",
      domain: "authority-and-governance",
      recommended_probes: [
        {
          operation:
            "Ask a process-mapping question: 'Whose specific criteria need to be satisfied for a green light, and can we include them for 10 minutes on Thursday?'",
          rationale:
            "True principals specify concrete criteria immediately; intermediaries guarding turf resist direct principal contact or reveal the real veto holder.",
        },
      ],
    },
  ];

  return {
    engine_label: "REL Deterministic Pragmatic & Game-Theoretic Expounder",
    global_architecture: {
      executive_subtext_translation: subtextParts.join(" "),
      core_logical_architecture:
        `The sequence progresses from ${units[0]?.speech_acts[0] || "opening framing"} in S01 through ${units.length} structured moves (${dominantPatterns.join(", ") || "direct propositional claims"}). ` +
        `Each unit builds an implicit funnel: establish reasonableness up front, treat background assumptions as settled common ground, soften or externalize constraints, and guide the counterpart toward accepting the speaker's preferred framing as the path of least resistance.`,
      actor_incentive_matrix,
      syllogistic_macro_chain: [
        "Premise 1 (Explicit Frame): Present the speaker's intent as collaborative, reasonable, or governed by objective circumstances.",
        "Premise 2 (Unstated Load-Bearing Assumption): The speaker's framing of constraints, urgency, or scope is treated as fixed reality rather than a negotiable choice.",
        "Premise 3 (Asymmetric Exchange): Maintaining harmony requires the counterpart to accommodate the elastic timeline, request, or boundary now while deferring hard reciprocity.",
        "Operational Conclusion: Secure compliance, patience, or optionality without surrendering unilateral flexibility.",
      ],
      strategic_response_playbook: [
        {
          strategy_name: "Warm Mirror + Concrete Pin (Convert Elastic Verbs to Dates)",
          when_to_use: "When you value the relationship but refuse to carry unpriced uncertainty or vague 'circle back' horizons.",
          exact_move_or_script:
            "Match their warm tone in clause 1, ignore pre-pivot fluff, and pin a concrete binary date/criterion: 'Completely understand the moving pieces. To plan my side cleanly, let's set [Date] as our decision checkpoint - if we haven't locked [Specific Item] by then, I will allocate that slot elsewhere.'",
          expected_counter_reaction:
            "High-intent actors immediately lock the date or counter-propose a nearby real date; low-intent optionality-keepers push back against any hard checkpoint.",
        },
        {
          strategy_name: "Blocker Isolation Test ('If We Solve X, Is Everything Else a Yes?')",
          when_to_use: "When an externalized blocker, policy, or bandwidth constraint is cited as the reason for refusal or concession.",
          exact_move_or_script:
            "Ask: 'If we solve [Stated Blocker X] completely on our end, are we ready to commit today, or is there another factor we should weigh upfront?'",
          expected_counter_reaction:
            "Exposes immediately whether [Stated Blocker X] was the real causal constraint or merely a polite proxy objection.",
        },
      ],
    },
    unit_expositions,
    omission_expositions,
    unresolved_unknowns,
  };
}

function synthesizeUnitDossier(u, idx, totalUnits, subject) {
  const codes = new Set(u.signals.map((s) => s.code));
  const posLabel =
    idx === 0
      ? "opening anchor"
      : idx === totalUnits - 1
      ? "closing exit / action hook"
      : `interior bridge (unit ${idx + 1} of ${totalUnits})`;

  const advClause = u.clauses.find((c) => c.role === "post-pivot-operational-payload");
  const preClause = u.clauses.find((c) => c.role === "pre-pivot-concession-or-cushion");

  let operationalFunction = `Operating as the ${posLabel}, this unit executes speech act(s) [${u.speech_acts.join(", ")}] with commitment profile '${u.agency_and_commitment.commitment_profile}'. `;
  if (advClause && preClause) {
    operationalFunction += `Crucially, it uses an adversative hinge: the opening clause ("${preClause.text.slice(0, 80)}") functions as relational cushioning to disarm resistance, while the post-pivot clause ("${advClause.text.slice(0, 90)}") delivers the speaker's actual priority and overrides the opening concession.`;
  } else if (codes.has("EXTERNALIZED_BLOCKER") || codes.has("PASSIVE_AGENCY_ERASURE")) {
    operationalFunction += `It separates the speaker personally from an unwelcome constraint by shifting causal agency onto impersonal processes or off-stage authorities, preserving interpersonal likability while refusing to budge.`;
  } else if (codes.has("VAGUE_COMMITMENT_HORIZON") || codes.has("STRATEGIC_ESCAPE_HATCH")) {
    operationalFunction += `It creates the psychological feeling of a forward promise while carefully withholding hard dates, numbers, or enforceable conditions, preserving cheap exit optionality.`;
  } else if (u.speech_acts.includes("directive-ask-or-probe")) {
    operationalFunction += `It steers the counterpart's next action or extracts information/concessions, framing compliance as the natural continuation of the preceding context.`;
  } else {
    operationalFunction += `It establishes the factual or evaluative frame that subsequent asks rely upon, shaping which questions feel 'in-bounds' versus 'awkward' to raise.`;
  }

  const hiddenPremises = [];
  if (codes.has("PRESUPPOSITION_TRIGGER")) {
    const trig = u.signals.find((s) => s.code === "PRESUPPOSITION_TRIGGER");
    hiddenPremises.push(
      `Presupposition trigger "${trig.match}" treats a debatable interpretation as already-settled common ground rather than an open claim requiring proof.`
    );
  }
  if (advClause && preClause) {
    hiddenPremises.push(
      `Assumes that acknowledging "${preClause.text.slice(0, 60)}" verbally discharges the obligation to act on it, allowing "${advClause.text.slice(0, 60)}" to take full precedence.`
    );
  }
  if (codes.has("EXTERNALIZED_BLOCKER")) {
    hiddenPremises.push(
      `Assumes the cited external rule, policy, or third party is immutable and that the speaker has zero influence or discretion to request an exception.`
    );
  }
  if (hiddenPremises.length === 0) {
    hiddenPremises.push(
      `Assumes the speaker's selection of facts in ${u.unit_id} is a complete and neutral representation of the situation rather than a curated slice aligned with their objective.`
    );
    hiddenPremises.push(
      `Assumes the counterpart shares the same urgency curve and cost-benefit weighting implied by this framing.`
    );
  }

  const signalBreakdowns = u.signals.length
    ? u.signals.map((s) => `"${s.match}" [${s.code}]: ${s.mechanic}`).join(" ")
    : `Clean declarative phrasing without overt lexical hedges (${u.word_count} words; pronoun balance I=${u.agency_and_commitment.first_person_singular_count}, We=${u.agency_and_commitment.collective_we_count}, You=${u.agency_and_commitment.second_person_target_count}), chosen to project matter-of-fact certainty.`;

  let counterfactual = "";
  if (advClause) {
    counterfactual = `Unvarnished version without the pre-pivot cushion: "${advClause.text.replace(/^(but|however|though|although|while)\s*,?\s*/i, "")}" - Notice how blunt that sounds alone; the opening clause exists specifically to soften that bluntness.`;
  } else if (codes.has("VAGUE_COMMITMENT_HORIZON")) {
    counterfactual = `If the actor wanted a binding commitment, they would have named a specific owner, deliverable, and calendar timestamp (e.g., 'I will send the signed decision by Thursday at 3 PM'); choosing elastic wording keeps their cost of delay at zero.`;
  } else if (codes.has("PASSIVE_AGENCY_ERASURE") || codes.has("EXTERNALIZED_BLOCKER")) {
    counterfactual = `Direct high-ownership version: 'I chose to prioritize Y over X, so I am saying no to X.' Replacing 'I chose' with impersonal phrasing avoids status conflict and counter-bargaining.`;
  } else {
    counterfactual = `Had the speaker omitted ${u.unit_id} or stated only raw numbers/facts without framing, the listener would evaluate the tradeoff from scratch instead of inside the speaker's chosen frame.`;
  }

  return {
    unit_id: u.unit_id,
    literal_surface: `At face value, ${u.unit_id}${u.speaker ? ` (${u.speaker})` : ""} states: "${u.text}"`,
    operational_function: operationalFunction,
    logic_chain: [
      `Explicit input (${u.unit_id}): "${u.text}"`,
      `Implicit inferential bridge: If the listener accepts this framing at face value, the burden shifts onto the listener to accommodate or justify any deviation.`,
      `Target behavioral effect: Narrow resistance and prime alignment for ${idx < totalUnits - 1 ? `unit S${String(idx + 2).padStart(2, "0")}` : "the desired post-message action"}.`,
    ],
    hidden_premises: hiddenPremises,
    motivational_stack: {
      surface_motive: "Communicate clearly, appear reasonable/cooperative, and maintain constructive norms.",
      tactical_motive: advClause
        ? "Neutralize anticipated objection upfront while pivoting control to the post-hinge condition."
        : "Establish favorable framing coordinates and manage conversational tempo.",
      core_self_interest:
        u.agency_and_commitment.commitment_profile === "soft-nonbinding-optionality"
          ? "Retain unilateral optionality and zero-penalty exit flexibility while keeping the counterpart engaged."
          : "Protect resources, time, leverage, or decision autonomy while advancing preferred terms.",
      ego_or_face_protection:
        "Preserve self-image and public reputation as fair, competent, and non-adversarial even while pursuing asymmetric terms.",
    },
    word_choice_forensics: signalBreakdowns,
    counterfactual_translation: counterfactual,
    hypotheses: [
      {
        id: "H1",
        label: "Calibrated Strategic Framing (Optionality & Friction Management)",
        probability: u.signals.length >= 2 ? 0.60 : 0.45,
        rationale: `Presence of ${u.signals.length} pragmatic micro-signal(s) and '${u.agency_and_commitment.commitment_profile}' commitment profile aligns with deliberate risk/face management.`,
      },
      {
        id: "H2",
        label: "Candid Constraint Reporting Under Social Politeness Norms",
        probability: u.signals.length >= 2 ? 0.28 : 0.43,
        rationale: "Standard professional etiquette often wraps genuine constraints in softening language to avoid unnecessary friction.",
      },
      {
        id: "H3",
        label: "Internal Coalition / Principal Buffering",
        probability: 0.12,
        rationale: "Wording reflects compromises or unresolved tension behind the scenes on the speaker's own side.",
      },
    ],
    diagnostic_probe: {
      probe_question_or_action: advClause
        ? `Acknowledge the post-pivot clause directly ("${advClause.text.slice(0, 60)}...") and ask what concrete condition or metric would turn it into a firm yes.`
        : `Reflect the core claim of ${u.unit_id} back in concrete, quantified terms and ask the speaker to confirm exact dates/owners.`,
      if_h1_true_expect: "They will hedge again, broaden the objection, or resist pinning a concrete threshold.",
      if_h2_true_expect: "They will show relief at plain talk and collaborate on a concrete, bounded workaround.",
    },
  };
}

function synthesizeOmissionDossier(om, subject) {
  return {
    omission_id: om.omission_id,
    why_expected: `In a transparent ${subject.kind} where both sides optimize solely for fast joint execution, '${om.title}' would be stated explicitly so neither party misallocates time or expectations. (${om.trigger_observation})`,
    strategic_function_of_silence:
      "Silence is an active strategic asset: what is never put in writing cannot be falsified, quoted back as a broken promise, or challenged directly without the questioner bearing the social cost of looking pushy.",
    hypotheses: [
      {
        id: "H1",
        label: "Deliberate Optionality Reservation",
        probability: 0.58,
        rationale: "Leaving this slot unspecified preserves freedom to pivot once external information arrives.",
      },
      {
        id: "H2",
        label: "Unresolved Internal Uncertainty or Conflict Avoidance",
        probability: 0.42,
        rationale: "The actor either has not resolved this internally yet or fears stating the true number/owner would break the deal immediately.",
      },
    ],
    diagnostic_probe: `Surface ${om.omission_id} neutrally in writing: 'To make sure nothing falls through the cracks on [${om.title}], what specific target date / owner / threshold should we pencil in right now?'`,
  };
}


/**
 * Publication-Grade Markdown Report Renderer for Reverse Engineer Logic (REL).
 * Strictly zero em-dashes; links every conclusion to cryptographic Evidence,
 * Obligation, Unknown, and Completion Ledger IDs.
 */
function renderMarkdownReport(bundle) {
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


const REL_MCP_TOOLS = [
  {
    name: "expound_situation_or_message",
    description:
      "Run a full Reverse Engineer Logic investigation on any message, email, dialogue, contract clause, or strategic situation. Segments every sentence/aspect, scans 16 pragmatic micro-signal classes, detects conspicuous omissions, builds an Obligation Ledger, expounds deeply on the logic and 4-layer motivation of EVERY unit and silence, and verifies 100% completion (ecl_...).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Verbatim message, dialogue, clause, or situation description to reverse engineer." },
        context: { type: "string", description: "Optional background context, actor relationships, stakes, or prior history." },
        provider: {
          type: "string",
          enum: [
            "auto",
            "anthropic",
            "gemini",
            "xai",
            "deepseek",
            "mistral",
            "openrouter",
            "ollama",
            "claude-cli",
            "gemini-cli",
            "agy",
            "builtin",
          ],
          description: "Synthesis engine ('auto' uses configured neural/CLI provider if available, 'builtin' runs fast deterministic structural synthesis).",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "open_subject",
    description:
      "Start a granular agent-driven Logic Reverse Engineering session on a message or situation: computes SHA-256 subject identity, decompiles all addressable units (S01..Sn) and conspicuous omissions (OM01..OMk), and generates the mandatory Obligation Ledger (obl_...) for step-by-step expounding.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Message, transcript, or situation to open." },
        context: { type: "string", description: "Optional situational context." },
        title: { type: "string", description: "Optional short label." },
      },
      required: ["text"],
    },
  },
  {
    name: "record_unit_exposition",
    description:
      "Record deep multi-layer logical and motivational exposition for one or more obligation units (S01..Sn or OM01..OMk) in the active MCP investigation session, minting an authenticated ev_... Evidence record.",
    inputSchema: {
      type: "object",
      properties: {
        unit_expositions: {
          type: "array",
          description: "Expositions for text units (S01..Sn).",
          items: {
            type: "object",
            properties: {
              unit_id: { type: "string" },
              literal_surface: { type: "string" },
              operational_function: { type: "string" },
              logic_chain: { type: "array", items: { type: "string" } },
              hidden_premises: { type: "array", items: { type: "string" } },
              motivational_stack: {
                type: "object",
                properties: {
                  surface_motive: { type: "string" },
                  tactical_motive: { type: "string" },
                  core_self_interest: { type: "string" },
                  ego_or_face_protection: { type: "string" },
                },
                required: ["surface_motive", "tactical_motive", "core_self_interest", "ego_or_face_protection"],
              },
              word_choice_forensics: { type: "string" },
              counterfactual_translation: { type: "string" },
              hypotheses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    label: { type: "string" },
                    probability: { type: "number" },
                    rationale: { type: "string" },
                  },
                  required: ["id", "label", "probability", "rationale"],
                },
              },
              diagnostic_probe: {
                type: "object",
                properties: {
                  probe_question_or_action: { type: "string" },
                  if_h1_true_expect: { type: "string" },
                  if_h2_true_expect: { type: "string" },
                },
                required: ["probe_question_or_action", "if_h1_true_expect", "if_h2_true_expect"],
              },
            },
            required: [
              "unit_id",
              "literal_surface",
              "operational_function",
              "logic_chain",
              "hidden_premises",
              "motivational_stack",
              "word_choice_forensics",
              "counterfactual_translation",
              "hypotheses",
              "diagnostic_probe",
            ],
          },
        },
        omission_expositions: {
          type: "array",
          description: "Expositions for conspicuous omissions (OM01..OMk).",
          items: {
            type: "object",
            properties: {
              omission_id: { type: "string" },
              why_expected: { type: "string" },
              strategic_function_of_silence: { type: "string" },
              hypotheses: { type: "array", items: { type: "object" } },
              diagnostic_probe: { type: "string" },
            },
            required: ["omission_id", "why_expected", "strategic_function_of_silence", "hypotheses", "diagnostic_probe"],
          },
        },
        global_architecture: {
          type: "object",
          description: "Optional macro subtext translation, actor incentive matrix, and strategic playbook.",
        },
      },
    },
  },
  {
    name: "evaluate_exposition_coverage",
    description:
      "Verify whether every single sentence, aspect, and conspicuous omission in the active session has been completely expounded. Mints an authenticated ecl_... Completion Ledger and lists any missing or truncated units.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "record_motivational_unknown",
    description:
      "Register an unresolved motivational or situational ambiguity in the session's versioned Unknown Registry (unk_...) along with falsification probes.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        domain: { type: "string" },
        recommended_probes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              operation: { type: "string" },
              rationale: { type: "string" },
            },
            required: ["operation", "rationale"],
          },
        },
      },
      required: ["question"],
    },
  },
  {
    name: "update_motivational_unknown",
    description: "Update or resolve an existing unk_... record with new behavioral or contextual evidence.",
    inputSchema: {
      type: "object",
      properties: {
        unknown_id: { type: "string" },
        status: { type: "string", enum: ["open", "investigating", "contradicted", "resolved"] },
        rationale: { type: "string" },
      },
      required: ["unknown_id", "status"],
    },
  },
  {
    name: "compare_messages_or_framings",
    description:
      "Compare two drafts, messages, or statements (Left V1 vs. Right V2) to detect commitment walkbacks, newly injected hedges, passive agency erasure, and authority-shield insertions.",
    inputSchema: {
      type: "object",
      properties: {
        left_text: { type: "string", description: "Original / baseline message or framing." },
        right_text: { type: "string", description: "Revised / subsequent message or framing." },
        left_title: { type: "string" },
        right_title: { type: "string" },
      },
      required: ["left_text", "right_text"],
    },
  },
  {
    name: "export_investigation_report",
    description:
      "Export the active investigation bundle to Markdown (.md), interactive HTML X-Ray Workbench (.html), or JSON (.json) on disk.",
    inputSchema: {
      type: "object",
      properties: {
        output_path: { type: "string", description: "Absolute file path (.md, .html, or .json)." },
        format: { type: "string", enum: ["markdown", "html", "json"] },
      },
      required: ["output_path"],
    },
  },
  {
    name: "get_session_status",
    description: "Inspect current Reverse Engineer Logic session state, obligation counts, evidence records, and open unknowns.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "reset_investigation",
    description: "Clear active in-memory investigation state (optionally saving bundle JSON to save_path first).",
    inputSchema: {
      type: "object",
      properties: {
        save_path: { type: "string" },
      },
    },
  },
];



globalThis.RELCore = {
  REL_MCP_TOOLS,
  prepareInvestigation(rawText, options = {}) {
    const subject = createSubject(rawText, options);
    const decompilation = decompileSubject(subject, rawText);
    const decompEvidence = createEvidence({
      subject,
      provider: { id: "rel-decompiler", name: "REL Pragmatic & Structural Decompiler", version: "1.0.0" },
      predicateType: "rel.decompilation",
      operation: "decompile_logic_structure",
      parameters: { char_length: subject.char_length },
      normalizedResult: {
        statistics: decompilation.statistics,
        unit_ids: decompilation.units.map(u => u.unit_id),
        omission_ids: decompilation.conspicuous_omissions.map(o => o.omission_id),
      },
      confidence: "observed",
      authority: "verbatim-source",
      limitations: ["Lexical and syntactic micro-signals establish structural framing, not internal subjective intent by themselves."],
      locations: decompilation.units.map(u => ({ kind: "unit-span", unit_id: u.unit_id, start: u.span.start, end: u.span.end })),
    });
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
    const prompt = buildExpoundingPrompt(subject, rawText, decompilation, obligationLedger);
    return JSON.stringify({
      subject,
      rawText,
      decompilation,
      obligationLedger,
      decompEvidence,
      oblEvidence,
      prompt,
    });
  },

  finalizeInvestigation(preparedJson, rawModelOutputOrNull, providerId, providerName, isNeural) {
    const prep = JSON.parse(preparedJson);
    const builtinBaseline = buildDeterministicDeepExposition(prep.subject, prep.rawText, prep.decompilation);
    let merged = builtinBaseline;
    let usedId = providerId || "builtin";
    let usedName = providerName || "Deterministic Pragmatic, Rhetorical & Game-Theoretic Expounder";
    let authority = "structural-pragmatics";
    let confidence = "derived";

    if (isNeural && rawModelOutputOrNull) {
      try {
        const parsed = extractJsonObject(rawModelOutputOrNull);
        merged = mergeAndGuaranteeCoverage(parsed, builtinBaseline, prep.decompilation);
        authority = "neural-synthesis";
        confidence = "inferred";
      } catch (err) {
        usedId = "builtin-fallback";
        usedName = builtinBaseline.engine_label + " (fallback after " + providerId + ": " + String(err.message).slice(0, 100) + ")";
      }
    }

    const exposition = {
      provider_used: { id: usedId, name: usedName, version: "1.0.0" },
      authority,
      confidence,
      global_architecture: merged.global_architecture,
      unit_expositions: merged.unit_expositions,
      omission_expositions: merged.omission_expositions,
      unresolved_unknowns: merged.unresolved_unknowns,
    };

    const expEvidence = createEvidence({
      subject: prep.subject,
      provider: exposition.provider_used,
      predicateType: "rel.exposition",
      operation: "expound_all_obligations",
      parameters: { obligation_ledger_id: prep.obligationLedger.ledger_id },
      normalizedResult: {
        global_architecture: exposition.global_architecture,
        unit_expositions_count: exposition.unit_expositions.length,
        omission_expositions_count: exposition.omission_expositions.length,
      },
      confidence: exposition.confidence,
      authority: exposition.authority,
      limitations: ["Motivational stacks and probability weights represent abductive models over textual and situational evidence; verify high-stakes conclusions using the supplied diagnostic probes."],
      evidenceLinks: [prep.decompEvidence.evidence_id, prep.oblEvidence.evidence_id],
    });

    const unitMap = new Map();
    for (const ue of exposition.unit_expositions) unitMap.set(ue.unit_id, ue);
    for (const oe of exposition.omission_expositions) unitMap.set(oe.omission_id, oe);
    for (const obl of prep.obligationLedger.obligations) {
      if (unitMap.has(obl.unit_id)) {
        obl.status = "verified";
        obl.fulfilling_evidence_ids = [expEvidence.evidence_id];
      }
    }

    const completionLedger = evaluateExpositionCoverage(prep.obligationLedger, unitMap, [
      prep.decompEvidence.evidence_id,
      expEvidence.evidence_id,
    ]);

    const completionEvidence = createEvidence({
      subject: prep.subject,
      provider: { id: "rel-verifier", name: "REL Obligation Coverage Verifier", version: "1.0.0" },
      predicateType: "rel.completion-ledger",
      operation: "evaluate_exposition_coverage",
      parameters: { completion_ledger_id: completionLedger.ledger_id },
      normalizedResult: completionLedger.summary,
      confidence: "derived",
      authority: "structural-pragmatics",
      evidenceLinks: [prep.oblEvidence.evidence_id, expEvidence.evidence_id],
    });

    const unknowns = (exposition.unresolved_unknowns || []).map(u =>
      createResidualUnknown({
        question: u.question,
        domain: u.domain || "motivation-disambiguation",
        scopeDigest: prep.subject.digest.sha256,
        severity: u.severity || "high",
        supportingEvidenceIds: [prep.decompEvidence.evidence_id, expEvidence.evidence_id],
        recommendedProbes: u.recommended_probes || [],
        mutationEvidenceIds: [expEvidence.evidence_id],
      })
    );

    const bundle = {
      bundle_format: "rel.investigation-bundle.v1",
      created_at: new Date().toISOString(),
      subject: prep.subject,
      raw_text: prep.rawText,
      decompilation: prep.decompilation,
      obligation_ledger: prep.obligationLedger,
      completion_ledger: completionLedger,
      exposition,
      unknowns,
      evidence_records: [prep.decompEvidence, prep.oblEvidence, expEvidence, completionEvidence],
    };
    bundle.markdown_report = renderMarkdownReport(bundle);
    return JSON.stringify(bundle);
  },

  decompileOnly(rawText, context) {
    const subject = createSubject(rawText, { context });
    const dec = decompileSubject(subject, rawText);
    const ev = createEvidence({
      subject,
      provider: { id: "rel-decompiler", name: "REL Pragmatic & Structural Decompiler", version: "1.0.0" },
      predicateType: "rel.decompilation",
      operation: "decompile_logic_structure",
      normalizedResult: dec,
      confidence: "observed",
      authority: "verbatim-source",
    });
    return JSON.stringify(ev, null, 2);
  },

  compareOnly(leftText, rightText) {
    const diff = compareFramings(leftText, rightText);
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
    return JSON.stringify({ evidence: ev, comparison: diff }, null, 2);
  },

  verifyBundleJson(bundleJson) {
    const bundle = JSON.parse(bundleJson);
    const issues = [];
    if (!bundle || bundle.bundle_format !== "rel.investigation-bundle.v1") {
      return JSON.stringify({ valid: false, issues: ["Unrecognized bundle_format"] }, null, 2);
    }
    for (const ev of bundle.evidence_records || []) {
      const check = verifyEvidenceIntegrity(ev);
      if (!check.valid) issues.push(check.reason);
    }
    if (!bundle.completion_ledger?.summary?.complete) {
      issues.push("Completion ledger reports incomplete obligation coverage.");
    }
    return JSON.stringify({
      valid: issues.length === 0,
      evidence_verified_count: (bundle.evidence_records || []).length,
      completion_ledger_id: bundle.completion_ledger?.ledger_id,
      complete: Boolean(bundle.completion_ledger?.summary?.complete),
      issues,
    }, null, 2);
  }
};
