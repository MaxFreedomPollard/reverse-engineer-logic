/**
 * Standalone Interactive Dark-Mode HTML X-Ray Workbench for Reverse Engineer Logic (REL).
 * Renders an interactive, clickable sentence-by-sentence and omission-by-omission
 * Logic & Motivation Inspector, plus live local analysis form when served via `rel serve`.
 */
export function renderHtmlWorkbench(bundle, options = { liveServer: false }) {
  const safeJson = JSON.stringify(bundle || null)
    .replace(/</g, "\\u003c")
    .replace(/\u2014/g, " - ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Reverse Engineer Logic (REL) - Interactive Logic & Motivation X-Ray</title>
<style>
  :root {
    --bg: #0b0e14;
    --panel: #121722;
    --panel-alt: #171e2c;
    --border: #253047;
    --text: #e6edf7;
    --muted: #94a3b8;
    --accent: #38bdf8;
    --accent-soft: rgba(56, 189, 248, 0.14);
    --amber: #fbbf24;
    --amber-soft: rgba(251, 191, 36, 0.14);
    --rose: #fb7185;
    --rose-soft: rgba(251, 113, 133, 0.14);
    --emerald: #34d399;
    --emerald-soft: rgba(52, 211, 153, 0.14);
    --violet: #a78bfa;
    --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    line-height: 1.55;
  }
  header {
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(180deg, #131926 0%, #0d111a 100%);
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge-logo {
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-family: var(--mono);
    font-weight: 700;
    font-size: 13px;
    padding: 5px 10px;
    border-radius: 6px;
    letter-spacing: 0.05em;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 650; }
  .ledger-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-family: var(--mono);
    font-size: 11.5px;
  }
  .pill {
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--muted);
  }
  .pill.ok {
    border-color: rgba(52, 211, 153, 0.45);
    color: var(--emerald);
    background: var(--emerald-soft);
  }
  .live-composer {
    padding: 16px 28px;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
    display: ${options.liveServer ? "block" : "none"};
  }
  .composer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr auto;
    gap: 12px;
    align-items: stretch;
  }
  textarea, input, select {
    width: 100%;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-family: var(--sans);
    font-size: 13.5px;
  }
  button.primary {
    background: var(--accent);
    color: #06121d;
    font-weight: 700;
    border: none;
    border-radius: 8px;
    padding: 0 20px;
    cursor: pointer;
    font-size: 13.5px;
  }
  button.primary:hover { filter: brightness(1.08); }
  .subtext-banner {
    margin: 20px 28px 0;
    padding: 18px 22px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(56,189,248,0.10), rgba(167,139,250,0.08));
    border: 1px solid rgba(56, 189, 248, 0.32);
  }
  .subtext-banner h2 {
    margin: 0 0 6px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
  }
  .subtext-banner p { margin: 0; font-size: 15px; }
  .workspace {
    display: grid;
    grid-template-columns: 44% 56%;
    gap: 20px;
    padding: 20px 28px 40px;
    align-items: start;
  }
  @media (max-width: 1024px) {
    .workspace { grid-template-columns: 1fr; }
    .composer-grid { grid-template-columns: 1fr; }
  }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 16px;
  }
  .card h3 {
    margin: 0 0 12px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .unit-item {
    padding: 12px 14px;
    border-radius: 9px;
    border: 1px solid var(--border);
    background: var(--panel-alt);
    margin-bottom: 10px;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.1s;
  }
  .unit-item:hover { border-color: var(--accent); }
  .unit-item.active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }
  .unit-item.omission { border-left: 3px solid var(--rose); }
  .unit-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--muted);
    margin-bottom: 6px;
  }
  .unit-id { color: var(--accent); font-weight: 700; }
  .omission .unit-id { color: var(--rose); }
  .sig-chip {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10.5px;
    padding: 2px 6px;
    margin: 4px 4px 0 0;
    border-radius: 4px;
    background: var(--amber-soft);
    color: var(--amber);
    border: 1px solid rgba(251, 191, 36, 0.3);
  }
  .dossier-section {
    margin-bottom: 16px;
    padding-bottom: 14px;
    border-bottom: 1px solid rgba(37, 48, 71, 0.65);
  }
  .dossier-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .label {
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    margin-bottom: 6px;
  }
  .motive-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .motive-box {
    background: var(--panel-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
  }
  .motive-box strong {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: var(--violet);
    margin-bottom: 4px;
  }
  .hyp-row {
    margin-bottom: 10px;
    background: var(--panel-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .hyp-bar-bg {
    height: 6px;
    background: #0b0e14;
    border-radius: 4px;
    overflow: hidden;
    margin: 6px 0;
  }
  .hyp-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--violet));
  }
  .probe-box {
    background: var(--emerald-soft);
    border: 1px solid rgba(52, 211, 153, 0.35);
    border-radius: 8px;
    padding: 12px 14px;
    font-size: 13.5px;
  }
  ul.tight { margin: 6px 0 0; padding-left: 18px; }
  ul.tight li { margin-bottom: 5px; font-size: 13.5px; }
</style>
</head>
<body>
<header>
  <div class="brand">
    <span class="badge-logo">REL v1.0</span>
    <h1>Reverse Engineer Logic: Situation & Message X-Ray</h1>
  </div>
  <div class="ledger-pills" id="ledgerPills"></div>
</header>

<section class="live-composer">
  <div class="composer-grid">
    <textarea id="inputMessage" rows="3" placeholder="Paste any message, email, negotiation, contract clause, dialogue, or complex situation to reverse engineer its logic and motivation..."></textarea>
    <div>
      <input id="inputContext" placeholder="Optional context (e.g. 'Investor replying after term sheet ask')" style="margin-bottom:8px;" />
      <select id="inputProvider">
        <option value="auto">Provider: Auto (Deep Neural if available, else Builtin)</option>
        <option value="builtin">Provider: Fast Deterministic Builtin (<50ms)</option>
        <option value="agy">Provider: Local AGY CLI Deep Synthesis</option>
      </select>
    </div>
    <button class="primary" id="analyzeBtn">Reverse Engineer Logic</button>
  </div>
</section>

<div class="subtext-banner" id="subtextBanner" style="display:none;">
  <h2>Executive Subtext Translation (Stripped of Social Anesthetic)</h2>
  <p id="subtextBody"></p>
</div>

<main class="workspace" id="mainWorkspace" style="display:none;">
  <div>
    <div class="card">
      <h3>Decompiled Addressable Units (Click Any Sentence or Aspect)</h3>
      <div id="unitList"></div>
    </div>
    <div class="card">
      <h3>Conspicuous Omissions (What Was Strategically Left Unsaid)</h3>
      <div id="omissionList"></div>
    </div>
    <div class="card">
      <h3>Actor Incentive, Fear & BATNA Matrix</h3>
      <div id="actorMatrix"></div>
    </div>
  </div>

  <div>
    <div class="card" id="inspectorCard">
      <h3 id="inspectorTitle">Unit Logic & Motivation Dossier</h3>
      <div id="inspectorBody"></div>
    </div>
    <div class="card">
      <h3>Strategic Counter-Playbook & Falsification Probes</h3>
      <div id="playbookBody"></div>
    </div>
  </div>
</main>

<script>
let BUNDLE = ${safeJson};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBundle(b) {
  if (!b) return;
  BUNDLE = b;
  document.getElementById("subtextBanner").style.display = "block";
  document.getElementById("mainWorkspace").style.display = "grid";

  const pills = document.getElementById("ledgerPills");
  const cov = Math.round((b.completion_ledger.summary.coverage_ratio || 0) * 100);
  pills.innerHTML = [
    '<span class="pill ok">Coverage: ' + cov + '% (' + b.completion_ledger.summary.pass + '/' + b.completion_ledger.summary.total + ' Obligations)</span>',
    '<span class="pill">Provider: ' + esc(b.exposition.provider_used.id) + '</span>',
    '<span class="pill">Completion: ' + esc(b.completion_ledger.ledger_id.slice(0, 18)) + '...</span>',
    '<span class="pill">Subject: ' + esc(b.subject.subject_id.slice(0, 16)) + '...</span>'
  ].join("");

  document.getElementById("subtextBody").textContent = b.exposition.global_architecture.executive_subtext_translation;

  const uList = document.getElementById("unitList");
  uList.innerHTML = b.decompilation.units.map((u, i) => {
    const chips = u.signals.map(s => '<span class="sig-chip">' + esc(s.code) + ': "' + esc(s.match) + '"</span>').join("");
    return '<div class="unit-item" data-kind="unit" data-id="' + esc(u.unit_id) + '">' +
      '<div class="unit-header"><span class="unit-id">' + esc(u.unit_id) + (u.speaker ? ' · ' + esc(u.speaker) : '') + '</span>' +
      '<span>[' + u.span.start + '..' + u.span.end + '] · ' + esc(u.agency_and_commitment.commitment_profile) + '</span></div>' +
      '<div>' + esc(u.text) + '</div>' +
      (chips ? '<div>' + chips + '</div>' : '') +
      '</div>';
  }).join("");

  const oList = document.getElementById("omissionList");
  oList.innerHTML = b.decompilation.conspicuous_omissions.map(o => {
    return '<div class="unit-item omission" data-kind="omission" data-id="' + esc(o.omission_id) + '">' +
      '<div class="unit-header"><span class="unit-id">' + esc(o.omission_id) + ' · SILENCE</span><span>' + esc(o.slot) + '</span></div>' +
      '<div><strong>' + esc(o.title) + '</strong></div>' +
      '<div style="font-size:12.5px;color:var(--muted);margin-top:4px;">' + esc(o.trigger_observation) + '</div>' +
      '</div>';
  }).join("");

  const aMat = document.getElementById("actorMatrix");
  aMat.innerHTML = (b.exposition.global_architecture.actor_incentive_matrix || []).map(a => {
    return '<div class="hyp-row">' +
      '<div style="font-weight:700;color:var(--accent);margin-bottom:6px;">' + esc(a.actor) + '</div>' +
      '<div style="font-size:13px;"><strong>Stated Goal:</strong> ' + esc(a.stated_goal) + '</div>' +
      '<div style="font-size:13px;margin-top:4px;"><strong>Revealed Incentives:</strong> ' + esc(a.revealed_incentives) + '</div>' +
      '<div style="font-size:13px;margin-top:4px;"><strong>Core Fears:</strong> ' + esc(a.core_fears_or_aversions) + '</div>' +
      '<div style="font-size:13px;margin-top:4px;"><strong>Leverage & BATNA:</strong> ' + esc(a.leverage_and_batna) + '</div>' +
      '</div>';
  }).join("");

  const play = document.getElementById("playbookBody");
  play.innerHTML = (b.exposition.global_architecture.strategic_response_playbook || []).map(p => {
    return '<div class="probe-box" style="margin-bottom:10px;">' +
      '<div style="font-weight:700;color:var(--emerald);margin-bottom:4px;">' + esc(p.strategy_name) + '</div>' +
      '<div style="font-size:12.5px;color:var(--muted);margin-bottom:6px;">When: ' + esc(p.when_to_use) + '</div>' +
      '<div><strong>Move / Script:</strong> ' + esc(p.exact_move_or_script) + '</div>' +
      '<div style="margin-top:6px;font-size:12.5px;"><strong>Expected Reaction:</strong> ' + esc(p.expected_counter_reaction) + '</div>' +
      '</div>';
  }).join("");

  document.querySelectorAll(".unit-item").forEach(el => {
    el.addEventListener("click", () => selectItem(el.dataset.kind, el.dataset.id));
  });

  if (b.decompilation.units.length > 0) {
    selectItem("unit", b.decompilation.units[0].unit_id);
  }
}

function selectItem(kind, id) {
  document.querySelectorAll(".unit-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === id);
  });
  const titleEl = document.getElementById("inspectorTitle");
  const bodyEl = document.getElementById("inspectorBody");

  if (kind === "omission") {
    const om = BUNDLE.decompilation.conspicuous_omissions.find(x => x.omission_id === id);
    const exp = BUNDLE.exposition.omission_expositions.find(x => x.omission_id === id);
    titleEl.textContent = id + " - Conspicuous Omission Dossier";
    bodyEl.innerHTML =
      '<div class="dossier-section"><div class="label">Omitted Variable</div><div><strong>' + esc(om.title) + '</strong> (' + esc(om.slot) + ')</div></div>' +
      '<div class="dossier-section"><div class="label">Why Expected in a Candid Baseline</div><div>' + esc(exp.why_expected) + '</div></div>' +
      '<div class="dossier-section"><div class="label">Strategic Benefit of Silence</div><div>' + esc(exp.strategic_function_of_silence) + '</div></div>' +
      '<div class="dossier-section"><div class="label">Competing Hypotheses</div>' + renderHypotheses(exp.hypotheses) + '</div>' +
      '<div class="dossier-section"><div class="label">Diagnostic Probe to Surface It</div><div class="probe-box">' + esc(exp.diagnostic_probe) + '</div></div>';
    return;
  }

  const u = BUNDLE.decompilation.units.find(x => x.unit_id === id);
  const exp = BUNDLE.exposition.unit_expositions.find(x => x.unit_id === id);
  titleEl.textContent = id + " - Complete Logic & Motivation Dossier";
  bodyEl.innerHTML =
    '<div class="dossier-section"><div class="label">Verbatim Unit</div><div style="font-size:15px;font-weight:500;">"' + esc(u.text) + '"</div></div>' +
    '<div class="dossier-section"><div class="label">Literal Surface vs. Operational Function</div>' +
      '<div style="color:var(--muted);font-size:13px;margin-bottom:6px;"><strong>Surface:</strong> ' + esc(exp.literal_surface) + '</div>' +
      '<div><strong>Operational Job:</strong> ' + esc(exp.operational_function) + '</div></div>' +
    '<div class="dossier-section"><div class="label">Underlying Logic Chain</div><ul class="tight">' +
      (exp.logic_chain || []).map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' +
    '<div class="dossier-section"><div class="label">Hidden / Load-Bearing Premises</div><ul class="tight">' +
      (exp.hidden_premises || []).map(x => '<li>' + esc(x) + '</li>').join("") + '</ul></div>' +
    '<div class="dossier-section"><div class="label">Four-Layer Motivational Stack</div><div class="motive-grid">' +
      '<div class="motive-box"><strong>1. Surface Optics</strong>' + esc(exp.motivational_stack.surface_motive) + '</div>' +
      '<div class="motive-box"><strong>2. Tactical Leverage</strong>' + esc(exp.motivational_stack.tactical_motive) + '</div>' +
      '<div class="motive-box"><strong>3. Core Self-Interest</strong>' + esc(exp.motivational_stack.core_self_interest) + '</div>' +
      '<div class="motive-box"><strong>4. Ego / Face Shield</strong>' + esc(exp.motivational_stack.ego_or_face_protection) + '</div>' +
    '</div></div>' +
    '<div class="dossier-section"><div class="label">Word-Choice Forensics</div><div>' + esc(exp.word_choice_forensics) + '</div></div>' +
    '<div class="dossier-section"><div class="label">Counterfactual Candid Translation</div><div style="color:var(--amber);">' + esc(exp.counterfactual_translation) + '</div></div>' +
    '<div class="dossier-section"><div class="label">Competing Motivational Hypotheses</div>' + renderHypotheses(exp.hypotheses) + '</div>' +
    '<div class="dossier-section"><div class="label">Falsification / Diagnostic Probe</div><div class="probe-box">' +
      '<div><strong>Probe:</strong> ' + esc(exp.diagnostic_probe?.probe_question_or_action || "") + '</div>' +
      '<div style="font-size:12.5px;margin-top:6px;"><strong>If H1:</strong> ' + esc(exp.diagnostic_probe?.if_h1_true_expect || "") + '</div>' +
      '<div style="font-size:12.5px;margin-top:4px;"><strong>If H2:</strong> ' + esc(exp.diagnostic_probe?.if_h2_true_expect || "") + '</div>' +
    '</div></div>';
}

function renderHypotheses(list) {
  return (list || []).map(h => {
    const pct = typeof h.probability === "number" ? Math.round(h.probability * 100) : 50;
    return '<div class="hyp-row">' +
      '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:650;"><span>' + esc(h.id) + ': ' + esc(h.label) + '</span><span>' + pct + '%</span></div>' +
      '<div class="hyp-bar-bg"><div class="hyp-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div style="font-size:12.5px;color:var(--muted);">' + esc(h.rationale) + '</div>' +
    '</div>';
  }).join("");
}

if (BUNDLE) renderBundle(BUNDLE);

const btn = document.getElementById("analyzeBtn");
if (btn) {
  btn.addEventListener("click", async () => {
    const text = document.getElementById("inputMessage").value.trim();
    if (!text) return;
    btn.disabled = true;
    btn.textContent = "Decompiling Logic...";
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          context: document.getElementById("inputContext").value.trim(),
          provider: document.getElementById("inputProvider").value
        })
      });
      const data = await res.json();
      if (data.error) alert(data.error);
      else renderBundle(data);
    } catch (e) {
      alert("Analysis failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Reverse Engineer Logic";
    }
  });
}
</script>
</body>
</html>`;
}
