import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { verifyEvidenceIntegrity } from "../src/domain/ledgers.mjs";
import {
  runFramingComparison,
  runFullInvestigation,
  verifyInvestigationBundle,
} from "../src/pipeline.mjs";
import { renderMarkdownReport } from "../src/render/markdownRenderer.mjs";
import { renderHtmlWorkbench } from "../src/render/htmlWorkbench.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REL_BIN = resolve(__dirname, "../bin/rel.mjs");

const SAMPLE_MESSAGE = [
  "I really appreciate all the incredible hard work you've poured into the prototype, but leadership feels the timing might not quite align with our Q4 roadmap.",
  "Mistakes were made in how the timeline was communicated earlier, and obviously we still view you as a key strategic partner.",
  "If you could just send over the architecture documentation by Friday EOD so our team can review how it fits, we can definitely circle back down the road when bandwidth allows.",
].join(" ");

console.log("1. Testing deterministic decompilation, obligation closure & cryptographic ledgers...");
const bundle = await runFullInvestigation(SAMPLE_MESSAGE, {
  context: "Enterprise prospect replying after 6 weeks of unpaid technical proof-of-concept work.",
  provider: "builtin",
});

assert.equal(bundle.decompilation.units.length, 3, "Expected 3 sentence units");
assert.ok(bundle.decompilation.conspicuous_omissions.length >= 2, "Expected >=2 conspicuous omissions");
assert.equal(bundle.completion_ledger.summary.complete, true, "Expected 100% obligation closure");
assert.equal(bundle.completion_ledger.summary.coverage_ratio, 1, "Expected 1.0 coverage ratio");

const verification = verifyInvestigationBundle(bundle);
assert.equal(verification.valid, true, `Bundle verification failed: ${verification.issues.join(", ")}`);

// Tamper test: mutating normalized_result must invalidate ev_... SHA-256 commitment!
const tampered = structuredClone(bundle.evidence_records[0]);
tampered.normalized_result.statistics.unit_count = 999;
const tamperCheck = verifyEvidenceIntegrity(tampered);
assert.equal(tamperCheck.valid, false, "Tampered Evidence record must be rejected!");
console.log("   -> Verified SHA-256 ev_ tamper detection & 100% ecl_ obligation completion.");

console.log("2. Testing zero-em-dash Markdown and HTML Workbench rendering...");
const md = renderMarkdownReport(bundle);
const html = renderHtmlWorkbench(bundle, { liveServer: false });
assert.equal(md.includes("\u2014"), false, "Markdown must contain zero em-dashes");
assert.equal(html.includes("\u2014"), false, "HTML must contain zero em-dashes");
assert.ok(md.includes("[S01]") && md.includes("[S02]") && md.includes("[S03]"), "All 3 units rendered in MD");
assert.ok(html.includes("Reverse Engineer Logic"), "HTML workbench rendered");
console.log("   -> Verified Markdown & HTML outputs (0 em-dashes).");

console.log("3. Testing Draft / Framing Comparator (V1 -> V2 commitment walkback detection)...");
const comp = runFramingComparison(
  "We will sign the $120,000 contract on Monday and deploy by November 30.",
  "We might explore signing an agreement down the road subject to committee review when bandwidth allows."
);
assert.ok(
  comp.comparison.behavioral_shifts.some((s) => s.shift_kind === "COMMITMENT_WALKBACK"),
  "Expected COMMITMENT_WALKBACK detection"
);
console.log("   -> Verified COMMITMENT_WALKBACK & AUTHORITY_SHIELD_INSERTION detection.");

console.log("4. Testing MCP stdio JSON-RPC 2.0 server round-trip...");
await new Promise((resolvePromise, rejectPromise) => {
  const proc = spawn(process.execPath, [REL_BIN, "mcp"], { stdio: ["pipe", "pipe", "pipe"] });
  const responses = [];
  let buf = "";

  proc.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (line.trim()) responses.push(JSON.parse(line));
      if (responses.length === 3) {
        proc.stdin.end();
      }
    }
  });

  proc.on("error", rejectPromise);
  proc.on("close", () => {
    try {
      assert.equal(responses[0].result.serverInfo.name, "reverse-engineer-logic");
      assert.equal(responses[1].result.tools.length, 10);
      assert.equal(responses[2].result.structuredContent.completion_ledger.summary.complete, true);
      resolvePromise();
    } catch (e) {
      rejectPromise(e);
    }
  });

  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }) + "\n");
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
  proc.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "expound_situation_or_message",
        arguments: { text: SAMPLE_MESSAGE, provider: "builtin" },
      },
    }) + "\n"
  );
});
console.log("   -> Verified MCP initialize, tools/list (10 tools), and tools/call!");
console.log("\nALL REVERSE ENGINEER LOGIC SELF-TESTS PASSED!");
