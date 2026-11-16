#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

function stripImportsAndExports(code) {
  return code
    .replace(/^\s*import\s+[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+(async\s+function|function|const|let|class)\s+/gm, "$1 ");
}

const ledgersRaw = stripImportsAndExports(readFileSync(resolve(ROOT, "src/domain/ledgers.mjs"), "utf8"));
const decompilerRaw = stripImportsAndExports(readFileSync(resolve(ROOT, "src/engine/decompiler.mjs"), "utf8"));
const comparatorRaw = stripImportsAndExports(readFileSync(resolve(ROOT, "src/engine/comparator.mjs"), "utf8"));
const mdRendererRaw = stripImportsAndExports(readFileSync(resolve(ROOT, "src/render/markdownRenderer.mjs"), "utf8"));
const expounderFull = readFileSync(resolve(ROOT, "src/engine/expounder.mjs"), "utf8");

// Extract pure functions from expounder.mjs (buildExpoundingPrompt, extractJsonObject, sanitizeNoEmDash, mergeAndGuaranteeCoverage, buildDeterministicDeepExposition, synthesizeUnitDossier, synthesizeOmissionDossier)
const promptIdx = expounderFull.indexOf("export function buildExpoundingPrompt");
const runCliIdx = expounderFull.indexOf("function runCliProcess");
const extractIdx = expounderFull.indexOf("function extractJsonObject");

const expounderPromptPart = stripImportsAndExports(expounderFull.slice(promptIdx, runCliIdx));
const expounderPurePart = stripImportsAndExports(expounderFull.slice(extractIdx));

const mcpFull = readFileSync(resolve(ROOT, "src/mcp/server.mjs"), "utf8");
const toolsStart = mcpFull.indexOf("export const REL_MCP_TOOLS =");
const sessionStart = mcpFull.indexOf("export class RelSession");
const mcpToolsPart = stripImportsAndExports(mcpFull.slice(toolsStart, sessionStart));

const bundle = `// Auto-generated JavaScriptCore bundle for Reverse Engineer Logic macOS Universal App & Native CLI/MCP
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
  return globalThis.__relSha256Hex(domainTag + "\\u0000" + canonicalJson(value, domainTag));
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

${ledgersRaw}

${decompilerRaw}

${comparatorRaw}

${expounderPromptPart}

${expounderPurePart}

${mdRendererRaw}

${mcpToolsPart}

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
`;

const outDir = resolve(ROOT, "macos/Resources");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "rel-jsc-core.js"), bundle, "utf8");
console.log("Wrote macos/Resources/rel-jsc-core.js:", bundle.length, "bytes");
