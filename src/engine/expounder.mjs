import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPOSITION_SCHEMA_PATH = resolve(__dirname, "../domain/exposition-schema.json");

function findExecutable(name, extraEnvVar) {
  const home = homedir();
  const pathDirs = (process.env.PATH || "").split(":").filter(Boolean);
  const candidates = [
    extraEnvVar ? process.env[extraEnvVar] : null,
    join(home, ".local", "bin", name),
    join("/opt/homebrew/bin", name),
    join("/usr/local/bin", name),
    ...pathDirs.map((d) => join(d, name)),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      accessSync(p, constants.X_OK);
      return p;
    } catch {
      // continue
    }
  }
  return null;
}

export function detectAvailableProviders() {
  const providers = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({ id: "anthropic", name: "Anthropic Claude Messages API", available: true, kind: "api" });
  }
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    providers.push({ id: "gemini", name: "Google Gemini API", available: true, kind: "api" });
  }
  if (process.env.XAI_API_KEY) {
    providers.push({ id: "xai", name: "xAI Grok API", available: true, kind: "api" });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({ id: "deepseek", name: "DeepSeek Reasoner/Chat API", available: true, kind: "api" });
  }
  if (process.env.MISTRAL_API_KEY) {
    providers.push({ id: "mistral", name: "Mistral Large API", available: true, kind: "api" });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ id: "openrouter", name: "OpenRouter Multi-Model API", available: true, kind: "api" });
  }
  if (process.env.REL_OLLAMA_MODEL || process.env.OLLAMA_MODEL) {
    providers.push({ id: "ollama", name: "Ollama Local Model Runtime", available: true, kind: "local-http" });
  }

  const claudeCli = findExecutable("claude", "REL_CLAUDE_COMMAND");
  if (claudeCli && process.env.REL_INSIDE_CLAUDE !== "1") {
    providers.push({ id: "claude-cli", name: "Claude Code Local CLI", available: true, kind: "cli", path: claudeCli });
  }

  const geminiCli = findExecutable("gemini", "REL_GEMINI_COMMAND");
  if (geminiCli && process.env.REL_INSIDE_GEMINI !== "1") {
    providers.push({ id: "gemini-cli", name: "Gemini Local CLI", available: true, kind: "cli", path: geminiCli });
  }

  const agyCli = findExecutable("agy", "REL_AGY_COMMAND");
  if (agyCli && process.env.REL_INSIDE_AGY !== "1") {
    providers.push({ id: "agy", name: "Antigravity Local CLI", available: true, kind: "cli", path: agyCli });
  }

  providers.push({
    id: "builtin",
    name: "Deterministic Pragmatic, Rhetorical & Game-Theoretic Expounder",
    available: true,
    kind: "offline-deterministic",
  });

  return { providers };
}

export function resolveProvider(requested = "auto") {
  const { providers } = detectAvailableProviders();
  if (requested === "ollama") {
    return {
      id: "ollama",
      name: "Ollama Local Model Runtime",
      available: true,
      kind: "local-http",
    };
  }
  if (requested && requested !== "auto") {
    const match = providers.find((p) => p.id === requested && p.available);
    if (!match) {
      throw new Error(
        `Requested provider '${requested}' is not configured or available. Available: ${providers.map((p) => p.id).join(", ")}`
      );
    }
    return match;
  }
  return providers[0];
}

export async function expoundAllObligations({
  subject,
  rawText,
  decompilation,
  obligationLedger,
  provider = "auto",
  effort = "high",
  timeoutMs = 120000,
}) {
  const resolved = resolveProvider(provider);
  const builtinBaseline = buildDeterministicDeepExposition(subject, rawText, decompilation);

  if (resolved.id === "builtin") {
    return {
      provider_used: { id: "builtin", name: resolved.name, version: "1.0.0" },
      authority: "structural-pragmatics",
      confidence: "derived",
      ...builtinBaseline,
    };
  }

  const prompt = buildExpoundingPrompt(subject, rawText, decompilation, obligationLedger);
  try {
    let rawJsonText = "";
    switch (resolved.id) {
      case "anthropic":
        rawJsonText = await runAnthropicProvider(prompt, timeoutMs);
        break;
      case "gemini":
        rawJsonText = await runGeminiProvider(prompt, timeoutMs);
        break;
      case "xai":
        rawJsonText = await runOpenAiCompatibleProvider({
          url: "https://api.x.ai/v1/chat/completions",
          apiKey: process.env.XAI_API_KEY,
          model: process.env.REL_XAI_MODEL || "grok-3",
          prompt,
          timeoutMs,
        });
        break;
      case "deepseek":
        rawJsonText = await runOpenAiCompatibleProvider({
          url: "https://api.deepseek.com/chat/completions",
          apiKey: process.env.DEEPSEEK_API_KEY,
          model: process.env.REL_DEEPSEEK_MODEL || "deepseek-chat",
          prompt,
          timeoutMs,
        });
        break;
      case "mistral":
        rawJsonText = await runOpenAiCompatibleProvider({
          url: "https://api.mistral.ai/v1/chat/completions",
          apiKey: process.env.MISTRAL_API_KEY,
          model: process.env.REL_MISTRAL_MODEL || "mistral-large-latest",
          prompt,
          timeoutMs,
        });
        break;
      case "openrouter":
        rawJsonText = await runOpenAiCompatibleProvider({
          url: "https://openrouter.ai/api/v1/chat/completions",
          apiKey: process.env.OPENROUTER_API_KEY,
          model: process.env.REL_OPENROUTER_MODEL || "anthropic/claude-sonnet-4",
          prompt,
          timeoutMs,
        });
        break;
      case "ollama":
        rawJsonText = await runOllamaProvider(prompt, timeoutMs);
        break;
      case "claude-cli":
        rawJsonText = await runCliProcess(
          resolved.path,
          ["-p", prompt, "--output-format", "json"],
          { REL_INSIDE_CLAUDE: "1" },
          timeoutMs
        );
        break;
      case "gemini-cli":
        rawJsonText = await runCliProcess(
          resolved.path,
          ["-p", prompt],
          { REL_INSIDE_GEMINI: "1" },
          timeoutMs
        );
        break;
      case "agy":
        rawJsonText = await runCliProcess(
          resolved.path,
          [
            "--disable-slash-commands",
            "--output-format=json",
            `--json-schema=${EXPOSITION_SCHEMA_PATH}`,
            `--effort=${effort}`,
            `--print-timeout=${Math.ceil(timeoutMs / 1000)}s`,
            `-p=${prompt}`,
          ],
          { REL_INSIDE_AGY: "1" },
          timeoutMs
        );
        break;
      default:
        throw new Error(`Unsupported provider: ${resolved.id}`);
    }

    const parsed = extractJsonObject(rawJsonText);
    const merged = mergeAndGuaranteeCoverage(parsed, builtinBaseline, decompilation);
    return {
      provider_used: { id: resolved.id, name: resolved.name, version: "1.0.0" },
      authority: "neural-synthesis",
      confidence: "inferred",
      ...merged,
    };
  } catch (err) {
    return {
      provider_used: {
        id: "builtin-fallback",
        name: `${builtinBaseline.engine_label} (fallback after ${resolved.id}: ${err.message.slice(0, 120)})`,
        version: "1.0.0",
      },
      authority: "structural-pragmatics",
      confidence: "derived",
      ...builtinBaseline,
    };
  }
}

export function buildExpoundingPrompt(subject, rawText, decompilation, obligationLedger) {
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

function runCliProcess(cmdPath, args, extraEnv, timeoutMs = 120000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmdPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });
    const outChunks = [];
    const errChunks = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      rejectPromise(new Error(`CLI provider timed out after ${timeoutMs}ms`));
    }, timeoutMs + 5000);

    child.stdout.on("data", (c) => outChunks.push(c));
    child.stderr.on("data", (c) => errChunks.push(c));
    child.on("error", (err) => {
      clearTimeout(timer);
      rejectPromise(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(outChunks).toString("utf8");
      if (code !== 0 && !stdout.trim()) {
        rejectPromise(new Error(`CLI exited ${code}: ${Buffer.concat(errChunks).toString("utf8").slice(0, 200)}`));
      } else {
        resolvePromise(stdout);
      }
    });
  });
}

async function runAnthropicProvider(prompt, timeoutMs) {
  const model = process.env.REL_ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = await res.json();
  return data.content?.map((c) => c.text || "").join("\n") || "";
}

async function runGeminiProvider(prompt, timeoutMs) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const model = process.env.REL_GEMINI_MODEL || "gemini-2.5-pro";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
}

async function runOpenAiCompatibleProvider({ url, apiKey, model, prompt, timeoutMs }) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Provider HTTP ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function runOllamaProvider(prompt, timeoutMs) {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.REL_OLLAMA_MODEL || process.env.OLLAMA_MODEL || "llama3.3";
  const res = await fetch(`${host.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      format: "json",
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.message?.content || "";
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

export function buildDeterministicDeepExposition(subject, rawText, decompilation) {
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
