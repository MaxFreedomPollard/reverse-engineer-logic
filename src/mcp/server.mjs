import { writeFile } from "node:fs/promises";
import {
  buildObligationLedger,
  createEvidence,
  createResidualUnknown,
  createSubject,
  evaluateExpositionCoverage,
  updateResidualUnknown,
} from "../domain/ledgers.mjs";
import { decompileSubject } from "../engine/decompiler.mjs";
import { runFramingComparison, runFullInvestigation } from "../pipeline.mjs";
import { renderMarkdownReport } from "../render/markdownRenderer.mjs";
import { renderHtmlWorkbench } from "../render/htmlWorkbench.mjs";

/**
 * Reverse Engineer Logic (REL) Model Context Protocol (MCP) Server.
 * Modeled directly on REA's `EvidenceMcpServerCore.js`: maintains an in-memory
 * stateful investigation ledger (Subject, Decompilation, ObligationLedger,
 * UnitExpositions, ResidualUnknowns, and authenticated `ev_...` records) over stdio.
 */
export const REL_MCP_TOOLS = [
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

export class RelSession {
  constructor() {
    this.reset();
  }

  reset() {
    this.subject = null;
    this.rawText = null;
    this.decompilation = null;
    this.obligationLedger = null;
    this.unitExpositions = new Map();
    this.globalArchitecture = null;
    this.unknowns = new Map();
    this.evidenceRecords = [];
    this.lastBundle = null;
  }

  async callTool(name, args = {}) {
    switch (name) {
      case "expound_situation_or_message": {
        const bundle = await runFullInvestigation(args.text, {
          context: args.context,
          provider: args.provider || "auto",
        });
        this.subject = bundle.subject;
        this.rawText = bundle.raw_text;
        this.decompilation = bundle.decompilation;
        this.obligationLedger = bundle.obligation_ledger;
        this.globalArchitecture = bundle.exposition.global_architecture;
        this.unitExpositions.clear();
        for (const u of bundle.exposition.unit_expositions) this.unitExpositions.set(u.unit_id, u);
        for (const o of bundle.exposition.omission_expositions) this.unitExpositions.set(o.omission_id, o);
        this.unknowns.clear();
        for (const unk of bundle.unknowns) this.unknowns.set(unk.unknown_id, unk);
        this.evidenceRecords = [...bundle.evidence_records];
        this.lastBundle = bundle;
        return bundle;
      }

      case "open_subject": {
        this.reset();
        this.rawText = args.text;
        this.subject = createSubject(args.text, { title: args.title, context: args.context });
        this.decompilation = decompileSubject(this.subject, args.text);
        const decompEv = createEvidence({
          subject: this.subject,
          operation: "open_subject",
          normalizedResult: this.decompilation,
          confidence: "observed",
          authority: "verbatim-source",
        });
        this.evidenceRecords.push(decompEv);
        this.obligationLedger = buildObligationLedger(this.subject, this.decompilation, decompEv.evidence_id);
        return {
          evidence_id: decompEv.evidence_id,
          subject: this.subject,
          decompilation: this.decompilation,
          obligation_ledger: this.obligationLedger,
        };
      }

      case "record_unit_exposition": {
        if (!this.subject || !this.obligationLedger) {
          throw new Error("No open subject. Call open_subject or expound_situation_or_message first.");
        }
        const recordedIds = [];
        for (const ue of args.unit_expositions || []) {
          this.unitExpositions.set(ue.unit_id, ue);
          recordedIds.push(ue.unit_id);
        }
        for (const oe of args.omission_expositions || []) {
          this.unitExpositions.set(oe.omission_id, oe);
          recordedIds.push(oe.omission_id);
        }
        if (args.global_architecture) {
          this.globalArchitecture = args.global_architecture;
        }
        const ev = createEvidence({
          subject: this.subject,
          provider: { id: "mcp-analyst", name: "Host Agent Analyst", version: "1.0.0" },
          predicateType: "rel.exposition",
          operation: "record_unit_exposition",
          parameters: { recorded_units: recordedIds },
          normalizedResult: { recorded_count: recordedIds.length, recorded_units: recordedIds },
          confidence: "inferred",
          authority: "analyst-inference",
          evidenceLinks: this.evidenceRecords.map((e) => e.evidence_id),
        });
        this.evidenceRecords.push(ev);
        for (const obl of this.obligationLedger.obligations) {
          if (this.unitExpositions.has(obl.unit_id)) {
            obl.status = "verified";
            obl.fulfilling_evidence_ids = [ev.evidence_id];
          }
        }
        const coverage = evaluateExpositionCoverage(this.obligationLedger, this.unitExpositions, [ev.evidence_id]);
        return {
          evidence_id: ev.evidence_id,
          recorded_units: recordedIds,
          coverage_summary: coverage.summary,
          remaining_diagnostics: coverage.diagnostics,
        };
      }

      case "evaluate_exposition_coverage": {
        if (!this.obligationLedger) {
          throw new Error("No active obligation ledger. Call open_subject first.");
        }
        const completion = evaluateExpositionCoverage(
          this.obligationLedger,
          this.unitExpositions,
          this.evidenceRecords.map((e) => e.evidence_id)
        );
        return completion;
      }

      case "record_motivational_unknown": {
        const scopeDigest = this.subject ? this.subject.digest.sha256 : null;
        const ev = createEvidence({
          subject: this.subject,
          operation: "record_motivational_unknown",
          normalizedResult: { question: args.question },
          confidence: "inferred",
          authority: "analyst-inference",
        });
        this.evidenceRecords.push(ev);
        const unk = createResidualUnknown({
          question: args.question,
          domain: args.domain || "motivation-disambiguation",
          scopeDigest,
          severity: args.severity || "high",
          supportingEvidenceIds: [ev.evidence_id],
          recommendedProbes: args.recommended_probes || [],
          mutationEvidenceIds: [ev.evidence_id],
        });
        this.unknowns.set(unk.unknown_id, unk);
        return unk;
      }

      case "update_motivational_unknown": {
        const existing = this.unknowns.get(args.unknown_id);
        if (!existing) throw new Error(`Unknown ID not found: ${args.unknown_id}`);
        const ev = createEvidence({
          subject: this.subject,
          operation: "update_motivational_unknown",
          normalizedResult: { unknown_id: args.unknown_id, status: args.status },
          confidence: "observed",
          authority: "contextual-premise",
        });
        this.evidenceRecords.push(ev);
        const updated = updateResidualUnknown(
          existing,
          {
            status: args.status,
            resolution:
              args.status === "resolved"
                ? { disposition: "verified", rationale: args.rationale || "Resolved.", evidence_ids: [ev.evidence_id] }
                : null,
          },
          ev.evidence_id
        );
        this.unknowns.set(updated.unknown_id, updated);
        return updated;
      }

      case "compare_messages_or_framings": {
        return runFramingComparison(args.left_text, args.right_text, {
          leftTitle: args.left_title,
          rightTitle: args.right_title,
        });
      }

      case "export_investigation_report": {
        const bundle = this.materializeBundle();
        const fmt =
          args.format ||
          (args.output_path.endsWith(".html")
            ? "html"
            : args.output_path.endsWith(".json")
            ? "json"
            : "markdown");
        let content = "";
        if (fmt === "html") content = renderHtmlWorkbench(bundle, { liveServer: false });
        else if (fmt === "json") content = JSON.stringify(bundle, null, 2);
        else content = renderMarkdownReport(bundle);
        await writeFile(args.output_path, content, "utf8");
        return {
          exported_path: args.output_path,
          format: fmt,
          bytes_written: Buffer.byteLength(content, "utf8"),
          completion_ledger_id: bundle.completion_ledger.ledger_id,
          complete: bundle.completion_ledger.summary.complete,
        };
      }

      case "get_session_status": {
        const completion = this.obligationLedger
          ? evaluateExpositionCoverage(
              this.obligationLedger,
              this.unitExpositions,
              this.evidenceRecords.map((e) => e.evidence_id)
            ).summary
          : null;
        return {
          active_subject: this.subject,
          evidence_count: this.evidenceRecords.length,
          open_unknowns_count: [...this.unknowns.values()].filter((u) => u.status !== "resolved").length,
          coverage: completion,
        };
      }

      case "reset_investigation": {
        let saved = null;
        if (args.save_path && this.subject) {
          const b = this.materializeBundle();
          await writeFile(args.save_path, JSON.stringify(b, null, 2), "utf8");
          saved = args.save_path;
        }
        this.reset();
        return { reset: true, saved_bundle_path: saved };
      }

      default:
        throw new Error(`Unknown REL MCP tool: ${name}`);
    }
  }

  materializeBundle() {
    if (this.lastBundle && this.lastBundle.subject?.subject_id === this.subject?.subject_id) {
      return this.lastBundle;
    }
    if (!this.subject || !this.decompilation || !this.obligationLedger) {
      throw new Error("No active investigation to export.");
    }
    const completion = evaluateExpositionCoverage(
      this.obligationLedger,
      this.unitExpositions,
      this.evidenceRecords.map((e) => e.evidence_id)
    );
    return {
      bundle_format: "rel.investigation-bundle.v1",
      created_at: new Date().toISOString(),
      subject: this.subject,
      raw_text: this.rawText,
      decompilation: this.decompilation,
      obligation_ledger: this.obligationLedger,
      completion_ledger: completion,
      exposition: {
        provider_used: { id: "mcp-session", name: "MCP Agent-Driven Investigation", version: "1.0.0" },
        authority: "analyst-inference",
        confidence: "inferred",
        global_architecture: this.globalArchitecture || {
          executive_subtext_translation: "Agent-driven session synthesis.",
          core_logical_architecture: "",
          actor_incentive_matrix: [],
          syllogistic_macro_chain: [],
          strategic_response_playbook: [],
        },
        unit_expositions: this.decompilation.units
          .map((u) => this.unitExpositions.get(u.unit_id))
          .filter(Boolean),
        omission_expositions: this.decompilation.conspicuous_omissions
          .map((o) => this.unitExpositions.get(o.omission_id))
          .filter(Boolean),
      },
      unknowns: [...this.unknowns.values()],
      evidence_records: this.evidenceRecords,
    };
  }
}

/**
 * Start stdio MCP server supporting standard newline-delimited JSON-RPC 2.0
 * (MCP 2024-11-05 / 2025-03-26 stdio transport) as well as Content-Length framing.
 */
export async function runMcpStdioServer() {
  const session = new RelSession();
  let useContentLength = false;
  let buffer = Buffer.alloc(0);

  const sendMessage = (obj) => {
    const json = JSON.stringify(obj);
    if (useContentLength) {
      const byteLen = Buffer.byteLength(json, "utf8");
      process.stdout.write(`Content-Length: ${byteLen}\r\n\r\n${json}`);
    } else {
      process.stdout.write(`${json}\n`);
    }
  };

  const handleRpc = async (msg) => {
    if (!msg || typeof msg !== "object") return;
    const { id, method, params } = msg;

    // Notifications have no id
    if (id === undefined || id === null) return;

    try {
      if (method === "initialize") {
        const clientProto = params?.protocolVersion || "2024-11-05";
        sendMessage({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: clientProto,
            capabilities: { tools: {} },
            serverInfo: {
              name: "reverse-engineer-logic",
              version: "1.0.0",
            },
          },
        });
      } else if (method === "ping") {
        sendMessage({ jsonrpc: "2.0", id, result: {} });
      } else if (method === "tools/list") {
        sendMessage({
          jsonrpc: "2.0",
          id,
          result: { tools: REL_MCP_TOOLS },
        });
      } else if (method === "tools/call") {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const output = await session.callTool(toolName, toolArgs);
        sendMessage({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
            isError: false,
          },
        });
      } else if (method === "resources/list") {
        sendMessage({ jsonrpc: "2.0", id, result: { resources: [] } });
      } else if (method === "prompts/list") {
        sendMessage({ jsonrpc: "2.0", id, result: { prompts: [] } });
      } else {
        sendMessage({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
      }
    } catch (err) {
      if (method === "tools/call") {
        sendMessage({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify({ error: err.message }) }],
            isError: true,
          },
        });
      } else {
        sendMessage({
          jsonrpc: "2.0",
          id,
          error: { code: -32603, message: err.message },
        });
      }
    }
  };

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length > 0) {
      const asciiStart = buffer.subarray(0, Math.min(buffer.length, 32)).toString("utf8");
      if (asciiStart.startsWith("Content-Length:")) {
        useContentLength = true;
        const sepIdx = buffer.indexOf("\r\n\r\n");
        if (sepIdx === -1) break;
        const header = buffer.subarray(0, sepIdx).toString("utf8");
        const m = header.match(/Content-Length:\s*(\d+)/i);
        const len = m ? parseInt(m[1], 10) : 0;
        const totalNeeded = sepIdx + 4 + len;
        if (buffer.length < totalNeeded) break;
        const body = buffer.subarray(sepIdx + 4, totalNeeded).toString("utf8");
        buffer = buffer.subarray(totalNeeded);
        try {
          handleRpc(JSON.parse(body));
        } catch {
          // ignore malformed frame
        }
      } else {
        const nlIdx = buffer.indexOf("\n");
        if (nlIdx === -1) break;
        const line = buffer.subarray(0, nlIdx).toString("utf8").trim();
        buffer = buffer.subarray(nlIdx + 1);
        if (!line) continue;
        try {
          handleRpc(JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    }
  });

  await new Promise((resolve) => {
    process.stdin.on("end", resolve);
  });
}
