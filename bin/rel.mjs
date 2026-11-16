#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { createSubject, createEvidence } from "../src/domain/ledgers.mjs";
import { decompileSubject } from "../src/engine/decompiler.mjs";
import { detectAvailableProviders } from "../src/engine/expounder.mjs";
import {
  runFramingComparison,
  runFullInvestigation,
  verifyInvestigationBundle,
} from "../src/pipeline.mjs";
import { renderMarkdownReport } from "../src/render/markdownRenderer.mjs";
import { renderHtmlWorkbench } from "../src/render/htmlWorkbench.mjs";
import { runMcpStdioServer, REL_MCP_TOOLS } from "../src/mcp/server.mjs";
import { inspectAgentClients, configureAgentClients } from "../src/setup/agentSetup.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");

process.stdout.on("error", (err) => {
  if (err && err.code === "EPIPE") process.exit(141);
  throw err;
});

const rawArgs = process.argv.slice(2);

if (rawArgs[0] === "mcp" || rawArgs[0] === "--mcp") {
  await runMcpStdioServer();
  process.exit(0);
}

const HELP_TEXT = `Reverse Engineer Logic (rel v1.0.0)
Discern the underlying logic, hidden premises, micro-signals, omissions, and
four-layer motivations behind any message, document, or situation.

Usage:
  rel analyze [text] [options]      Full logic & motivation reverse engineering (100% unit closure)
  rel decompile [text] [options]    Instant (<50ms) deterministic structural, pivot & omission disassembly
  rel compare --left A --right B    Compare two drafts/messages for commitment walkbacks & hedge shifts
  rel verify <bundle.json>          Verify SHA-256 Evidence IDs (ev_...) & Completion Ledger (ecl_...)
  rel setup [options]               Configure MCP & skill integrations across AI clients (REA-style)
  rel doctor [--json]               Inspect runtime, LLM synthesis providers, and AI agent clients
  rel serve [--port 4747]           Launch interactive Logic & Motivation X-Ray Workbench in HTTP mode
  rel mcp                           Start Model Context Protocol (MCP) stdio server

Providers (--provider):
  auto | anthropic | gemini | xai | deepseek | mistral | openrouter | ollama | claude-cli | gemini-cli | agy | builtin

Options for 'setup':
  --all-detected                    Configure every detected AI client on this computer
  --client <id>                     Configure specific client (repeatable: claude-desktop, claude-code,
                                    cursor, antigravity, gemini-cli, windsurf, vscode, zed, cline, opencode)
  --dry-run                         Print planned configuration changes without modifying disk
  -y, --yes                         Apply without confirmation
`;

async function readStdinIfPiped() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const ch of process.stdin) chunks.push(ch);
  return Buffer.concat(chunks).toString("utf8");
}

async function resolveInputText(positionals, values) {
  if (values.file) return await readFile(resolve(values.file), "utf8");
  if (positionals.length > 0) return positionals.join(" ");
  const piped = await readStdinIfPiped();
  if (piped.trim()) return piped;
  throw new Error("No input message or situation provided. Pass text inline, --file <path>, or via stdin.");
}

function resolveLauncher() {
  const macAppRel = "/Applications/Reverse Engineer Logic.app/Contents/MacOS/rel";
  if (process.platform === "darwin" && existsSync(macAppRel)) {
    return { command: macAppRel, args: ["mcp"] };
  }
  return { command: process.execPath, args: [resolve(__dirname, "rel.mjs"), "mcp"] };
}

const subcommand = rawArgs[0];

if (!subcommand || subcommand === "-h" || subcommand === "--help" || subcommand === "help") {
  process.stdout.write(HELP_TEXT);
  process.exit(0);
}

if (subcommand === "-v" || subcommand === "--version" || subcommand === "version") {
  process.stdout.write("reverse-engineer-logic 1.0.0\n");
  process.exit(0);
}

try {
  if (subcommand === "doctor") {
    const jsonMode = rawArgs.includes("--json");
    const { providers } = detectAvailableProviders();
    const launcher = resolveLauncher();
    const clients = inspectAgentClients({
      launcherCommand: launcher.command,
      launcherArgs: launcher.args,
    });
    const report = {
      healthy: true,
      name: "reverse-engineer-logic",
      version: "1.0.0",
      node_version: process.version,
      mcp_tool_count: REL_MCP_TOOLS.length,
      providers,
      agent_clients: clients,
    };
    if (jsonMode) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`Reverse Engineer Logic (rel v1.0.0) - HEALTHY\n`);
      process.stdout.write(`  Node runtime:   ${process.version}\n`);
      process.stdout.write(`  MCP tools:      ${REL_MCP_TOOLS.length} registered\n`);
      process.stdout.write(`  Synthesis Providers:\n`);
      for (const p of providers) {
        process.stdout.write(`    - ${p.id.padEnd(12)} : ${p.name}${p.path ? ` (${p.path})` : ""}\n`);
      }
      process.stdout.write(`  AI Agent Integrations:\n`);
      for (const c of clients) {
        const status = c.configured ? "CONFIGURED" : c.detected ? "DETECTED (run 'rel setup --all-detected')" : "not installed";
        process.stdout.write(`    - ${c.id.padEnd(15)} : ${status}\n`);
      }
    }
    process.exit(0);
  }

  if (subcommand === "setup") {
    const { values } = parseArgs({
      args: rawArgs.slice(1),
      options: {
        "all-detected": { type: "boolean", default: false },
        client: { type: "string", multiple: true },
        "dry-run": { type: "boolean", default: false },
        yes: { type: "boolean", short: "y", default: false },
        json: { type: "boolean", default: false },
      },
    });
    const clientIds = values.client || [];
    const allDetected = values["all-detected"] || clientIds.length === 0;
    const launcher = resolveLauncher();
    const skillPath = join(PACKAGE_ROOT, "skills", "reverse-engineer-logic", "SKILL.md");
    const skillMd = existsSync(skillPath) ? await readFile(skillPath, "utf8") : null;

    const result = configureAgentClients({
      clientIds,
      allDetected,
      launcherCommand: launcher.command,
      launcherArgs: launcher.args,
      skillMarkdownContent: skillMd,
      dryRun: values["dry-run"],
    });

    if (values.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      process.stdout.write(
        `${result.dry_run ? "[DRY RUN] Planned" : "Configured"} ${result.configured_count} AI agent integration(s):\n`
      );
      for (const a of result.actions) {
        process.stdout.write(`  - ${a.client_name} (${a.client_id}) -> ${a.config_path}${a.skill_path ? ` + skill` : ""}\n`);
      }
    }
    process.exit(0);
  }

  if (subcommand === "decompile") {
    const { values, positionals } = parseArgs({
      args: rawArgs.slice(1),
      options: {
        file: { type: "string", short: "f" },
        context: { type: "string", short: "c" },
        out: { type: "string", short: "o" },
      },
      allowPositionals: true,
    });
    const text = await resolveInputText(positionals, values);
    const subject = createSubject(text, { context: values.context });
    const dec = decompileSubject(subject, text);
    const ev = createEvidence({
      subject,
      provider: { id: "rel-decompiler", name: "REL Pragmatic & Structural Decompiler", version: "1.0.0" },
      predicateType: "rel.decompilation",
      operation: "decompile_logic_structure",
      normalizedResult: dec,
      confidence: "observed",
      authority: "verbatim-source",
    });
    const json = JSON.stringify(ev, null, 2);
    if (values.out) await writeFile(resolve(values.out), json, "utf8");
    process.stdout.write(`${json}\n`);
    process.exit(0);
  }

  if (subcommand === "analyze" || subcommand === "expound") {
    const { values, positionals } = parseArgs({
      args: rawArgs.slice(1),
      options: {
        file: { type: "string", short: "f" },
        context: { type: "string", short: "c" },
        provider: { type: "string", short: "p", default: "auto" },
        fast: { type: "boolean", default: false },
        effort: { type: "string", default: "high" },
        format: { type: "string", default: "markdown" },
        out: { type: "string", short: "o" },
        title: { type: "string" },
      },
      allowPositionals: true,
    });
    const text = await resolveInputText(positionals, values);
    const chosenProvider = values.fast ? "builtin" : values.provider;
    const bundle = await runFullInvestigation(text, {
      context: values.context,
      provider: chosenProvider,
      effort: values.effort,
      title: values.title,
    });

    if (values.out) {
      const target = resolve(values.out);
      if (target.endsWith(".md") || target.endsWith(".json") || target.endsWith(".html")) {
        const content = target.endsWith(".json")
          ? JSON.stringify(bundle, null, 2)
          : target.endsWith(".html")
          ? renderHtmlWorkbench(bundle, { liveServer: false })
          : renderMarkdownReport(bundle);
        await writeFile(target, content, "utf8");
      } else {
        await mkdir(target, { recursive: true });
        await writeFile(join(target, "report.md"), renderMarkdownReport(bundle), "utf8");
        await writeFile(join(target, "evidence-bundle.json"), JSON.stringify(bundle, null, 2), "utf8");
        await writeFile(join(target, "logic-xray-workbench.html"), renderHtmlWorkbench(bundle, { liveServer: false }), "utf8");
      }
    }

    if (values.format === "json") {
      process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
    } else if (values.format === "html") {
      process.stdout.write(renderHtmlWorkbench(bundle, { liveServer: false }));
    } else {
      process.stdout.write(`${renderMarkdownReport(bundle)}\n`);
    }
    process.exit(0);
  }

  if (subcommand === "compare") {
    const { values } = parseArgs({
      args: rawArgs.slice(1),
      options: {
        left: { type: "string" },
        right: { type: "string" },
        "left-file": { type: "string" },
        "right-file": { type: "string" },
      },
      allowPositionals: true,
    });
    const leftText = values["left-file"]
      ? await readFile(resolve(values["left-file"]), "utf8")
      : values.left;
    const rightText = values["right-file"]
      ? await readFile(resolve(values["right-file"]), "utf8")
      : values.right;
    if (!leftText || !rightText) {
      throw new Error("Usage: rel compare --left 'V1 text' --right 'V2 text' (or --left-file / --right-file)");
    }
    const res = runFramingComparison(leftText, rightText);
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    process.exit(0);
  }

  if (subcommand === "verify") {
    const bundlePath = rawArgs[1];
    if (!bundlePath) throw new Error("Usage: rel verify <evidence-bundle.json>");
    const data = JSON.parse(await readFile(resolve(bundlePath), "utf8"));
    const result = verifyInvestigationBundle(data);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exit(result.valid ? 0 : 1);
  }

  if (subcommand === "serve") {
    const { values } = parseArgs({
      args: rawArgs.slice(1),
      options: {
        port: { type: "string", default: "4747" },
      },
    });
    const port = parseInt(values.port, 10) || 4747;
    const server = createServer(async (req, res) => {
      if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(renderHtmlWorkbench(null, { liveServer: true }));
        return;
      }
      if (req.method === "POST" && req.url === "/api/analyze") {
        const chunks = [];
        for await (const ch of req) chunks.push(ch);
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const bundle = await runFullInvestigation(body.text, {
            context: body.context,
            provider: body.provider || "auto",
          });
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify(bundle));
        } catch (err) {
          res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      res.writeHead(404);
      res.end("Not found");
    });
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(`Reverse Engineer Logic Workbench listening on http://127.0.0.1:${port}\n`);
    });
  } else {
    throw new Error(`Unknown command '${subcommand}'. Run 'rel --help' for usage.`);
  }
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
