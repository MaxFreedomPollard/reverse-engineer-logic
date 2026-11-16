import AppKit
import Foundation
import WebKit

final class BridgeHandler: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    let engine: RelNativeEngine

    init(engine: RelNativeEngine) {
        self.engine = engine
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "relBridge",
              let body = message.body as? [String: Any],
              let reqId = body["reqId"] as? String,
              let action = body["action"] as? String else { return }

        let payload = body["payload"] as? [String: Any] ?? [:]

        Task { @MainActor in
            do {
                let resultJson: String
                switch action {
                case "getStatus":
                    struct StatusEnv: Codable {
                        let providers: [ProviderInfo]
                        let clients: [AgentClientStatus]
                        let ollamaHost: String
                        let ollamaModel: String
                    }
                    let env = StatusEnv(
                        providers: RelNativeEngine.detectProviders(),
                        clients: RelNativeEngine.inspectClients(),
                        ollamaHost: UserDefaults.standard.string(forKey: "rel_ollama_host") ?? "http://127.0.0.1:11434",
                        ollamaModel: UserDefaults.standard.string(forKey: "rel_ollama_model") ?? ""
                    )
                    let data = try JSONEncoder().encode(env)
                    resultJson = String(data: data, encoding: .utf8) ?? "{}"

                case "analyze":
                    let text = payload["text"] as? String ?? ""
                    let context = payload["context"] as? String
                    let provider = payload["provider"] as? String ?? "auto"
                    resultJson = try await engine.analyze(text: text, context: context, requestedProvider: provider)

                case "compare":
                    let left = payload["left"] as? String ?? ""
                    let right = payload["right"] as? String ?? ""
                    resultJson = try engine.compareOnly(left: left, right: right)

                case "saveKey":
                    let prov = payload["provider"] as? String ?? ""
                    let key = payload["key"] as? String ?? ""
                    if prov == "ollama" {
                        UserDefaults.standard.set(payload["host"] as? String ?? "http://127.0.0.1:11434", forKey: "rel_ollama_host")
                        UserDefaults.standard.set(key, forKey: "rel_ollama_model")
                    } else {
                        KeychainStore.setKey(key, for: prov)
                    }
                    resultJson = "{\"saved\":true}"

                case "configureAgents":
                    let allDetected = payload["allDetected"] as? Bool ?? true
                    let singleId = payload["clientId"] as? String
                    let ids = singleId.map { Set([$0]) }
                    let count = try RelNativeEngine.configureClients(ids: ids, allDetected: singleId == nil ? allDetected : false)
                    resultJson = "{\"configured\":\(count)}"

                case "installCliSymlink":
                    let home = FileManager.default.homeDirectoryForCurrentUser.path
                    let binDir = "\(home)/.local/bin"
                    try FileManager.default.createDirectory(atPath: binDir, withIntermediateDirectories: true)
                    let target = RelNativeEngine.resolvedMcpBinaryPath()
                    for alias in ["rel", "reverse-engineer-logic"] {
                        let linkPath = "\(binDir)/\(alias)"
                        try? FileManager.default.removeItem(atPath: linkPath)
                        try FileManager.default.createSymbolicLink(atPath: linkPath, withDestinationPath: target)
                    }
                    resultJson = "{\"linked\":\"\(binDir)/rel\"}"

                case "saveFile":
                    let content = payload["content"] as? String ?? ""
                    let defaultName = payload["filename"] as? String ?? "rel-report.md"
                    let panel = NSSavePanel()
                    panel.nameFieldStringValue = defaultName
                    panel.canCreateDirectories = true
                    if panel.runModal() == .OK, let url = panel.url {
                        try content.write(to: url, atomically: true, encoding: .utf8)
                        resultJson = "{\"saved\":true,\"path\":\(Self.jsonQuote(url.path))}"
                    } else {
                        resultJson = "{\"saved\":false}"
                    }

                default:
                    resultJson = "{\"error\":\"Unknown action\"}"
                }
                self.reply(reqId: reqId, ok: true, jsonPayload: resultJson)
            } catch {
                self.reply(reqId: reqId, ok: false, jsonPayload: Self.jsonQuote(error.localizedDescription))
            }
        }
    }

    private static func jsonQuote(_ s: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: [s])
        let str = data.flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
        return String(str.dropFirst().dropLast())
    }

    @MainActor
    private func reply(reqId: String, ok: Bool, jsonPayload: String) {
        let js = "window.__relResolve(\(Self.jsonQuote(reqId)), \(ok ? "true" : "false"), \(jsonPayload));"
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var bridge: BridgeHandler!

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMainMenu()

        let engine: RelNativeEngine
        do {
            engine = try RelNativeEngine()
        } catch {
            let alert = NSAlert()
            alert.messageText = "Engine Initialization Error"
            alert.informativeText = error.localizedDescription
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        bridge = BridgeHandler(engine: engine)
        let config = WKWebViewConfiguration()
        config.userContentController.add(bridge, name: "relBridge")

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1340, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = "Reverse Engineer Logic"
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(calibratedRed: 0.043, green: 0.055, blue: 0.078, alpha: 1.0)

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground")
        bridge.webView = webView

        window.contentView?.addSubview(webView)
        webView.loadHTMLString(Self.appHtml, baseURL: nil)

        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Reverse Engineer Logic", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit Reverse Engineer Logic", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu

        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editMenuItem.submenu = editMenu

        NSApp.mainMenu = mainMenu
    }

    static let appHtml = #"""
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  :root {
    --bg: #0b0e14; --panel: #121722; --panel2: #171e2c; --border: #253047;
    --text: #e6edf7; --muted: #94a3b8; --accent: #38bdf8; --accent-soft: rgba(56,189,248,0.14);
    --amber: #fbbf24; --rose: #fb7185; --emerald: #34d399; --violet: #a78bfa;
    --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); line-height: 1.5; user-select: text; }
  nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 24px; background: #101520; border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; }
  .logo-pill { background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent); font-family: var(--mono); font-size: 11.5px; padding: 3px 8px; border-radius: 6px; }
  .tabs { display: flex; gap: 6px; }
  .tab-btn {
    background: transparent; color: var(--muted); border: 1px solid transparent;
    padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;
  }
  .tab-btn.active { background: var(--accent-soft); color: var(--accent); border-color: rgba(56,189,248,0.35); }
  .view { display: none; padding: 20px 24px 36px; }
  .view.active { display: block; }
  textarea, input, select {
    width: 100%; background: #090c11; color: var(--text); border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px; font-family: var(--sans); font-size: 13.5px;
  }
  .btn {
    background: var(--accent); color: #05131f; font-weight: 700; border: none;
    border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 13px;
  }
  .btn.secondary { background: var(--panel2); color: var(--text); border: 1px solid var(--border); }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; }
  .card h3 { margin: 0 0 10px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); }
  .grid-2 { display: grid; grid-template-columns: 44% 56%; gap: 18px; align-items: start; }
  .banner {
    padding: 15px 18px; border-radius: 10px; margin: 14px 0;
    background: linear-gradient(135deg, rgba(56,189,248,0.12), rgba(167,139,250,0.09));
    border: 1px solid rgba(56,189,248,0.35);
  }
  .note-warn {
    padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 12.5px;
    background: rgba(251,191,36,0.10); border: 1px solid rgba(251,191,36,0.35); color: var(--amber);
  }
  .unit { padding: 11px 13px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel2); margin-bottom: 9px; cursor: pointer; }
  .unit.active { border-color: var(--accent); background: rgba(56,189,248,0.09); }
  .unit.omission { border-left: 3px solid var(--rose); }
  .chip { display: inline-block; font-family: var(--mono); font-size: 10.5px; padding: 2px 6px; margin: 4px 4px 0 0; border-radius: 4px; background: rgba(251,191,36,0.14); color: var(--amber); }
  .sec { margin-bottom: 13px; padding-bottom: 12px; border-bottom: 1px solid rgba(37,48,71,0.6); font-size: 13.5px; }
  .sec:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
  .lbl { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
  .motive-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .mbox { background: var(--panel2); border: 1px solid var(--border); border-radius: 7px; padding: 9px 11px; font-size: 12.5px; }
  .mbox b { display: block; font-size: 10.5px; text-transform: uppercase; color: var(--violet); margin-bottom: 3px; }
  .bar-bg { height: 6px; background: #080a0f; border-radius: 4px; overflow: hidden; margin: 5px 0; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--violet)); }
  .probe { background: rgba(52,211,153,0.11); border: 1px solid rgba(52,211,153,0.35); border-radius: 8px; padding: 10px 12px; font-size: 13px; }
  .row-between { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .status-badge { font-family: var(--mono); font-size: 11px; padding: 3px 8px; border-radius: 99px; }
  .st-ok { background: rgba(52,211,153,0.15); color: var(--emerald); border: 1px solid rgba(52,211,153,0.4); }
  .st-det { background: rgba(56,189,248,0.15); color: var(--accent); border: 1px solid rgba(56,189,248,0.4); }
  .st-off { background: var(--panel2); color: var(--muted); border: 1px solid var(--border); }
</style>
</head>
<body>
<nav>
  <div class="brand">
    <span class="logo-pill">REL v1.0</span>
    <span>Reverse Engineer Logic</span>
  </div>
  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('xray', this)">Situation & Message X-Ray</button>
    <button class="tab-btn" onclick="switchTab('compare', this)">Compare Drafts (V1 vs V2)</button>
    <button class="tab-btn" onclick="switchTab('providers', this)">LLM Providers</button>
    <button class="tab-btn" onclick="switchTab('agents', this)">AI Agent Integrations (MCP)</button>
  </div>
</nav>

<section id="tab-xray" class="view active">
  <div class="card">
    <div style="display:grid;grid-template-columns:2.1fr 1fr;gap:12px;">
      <div>
        <textarea id="msgInput" rows="4" placeholder="Paste any message, email, negotiation, policy, dialogue, or situation to discern the real logic and motivation behind every sentence and silence..."></textarea>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <input id="ctxInput" placeholder="Optional context (who sent it, stakes, history)" />
        <select id="provSelect"></select>
        <div style="display:flex;gap:8px;">
          <button class="btn" id="runBtn" style="flex:1;" onclick="runAnalyze()">Reverse Engineer Logic</button>
          <button class="btn secondary" onclick="loadSample()">Sample</button>
        </div>
      </div>
    </div>
  </div>

  <div id="xrayResult" style="display:none;">
    <div class="row-between" style="margin-bottom:8px;">
      <div id="ledgerSummary" style="font-family:var(--mono);font-size:11.5px;color:var(--emerald);"></div>
      <div style="display:flex;gap:8px;">
        <button class="btn secondary" onclick="exportBundle('md')">Save Markdown (.md)</button>
        <button class="btn secondary" onclick="exportBundle('json')">Save Evidence (.json)</button>
      </div>
    </div>
    <div class="banner">
      <div class="lbl">Executive Subtext Translation (Stripped of Social Anesthetic)</div>
      <div id="execSubtext" style="font-size:14.5px;"></div>
    </div>
    <div class="grid-2">
      <div>
        <div class="card"><h3>Addressable Units (100% Obligation Closure)</h3><div id="uList"></div></div>
        <div class="card"><h3>Conspicuous Omissions (Strategic Silences)</h3><div id="oList"></div></div>
        <div class="card"><h3>Actor Incentive, Fear & BATNA Matrix</h3><div id="aList"></div></div>
      </div>
      <div>
        <div class="card"><h3 id="dTitle">Unit Dossier</h3><div id="dBody"></div></div>
        <div class="card"><h3>Strategic Response Playbook</h3><div id="pBody"></div></div>
      </div>
    </div>
  </div>
</section>

<section id="tab-compare" class="view">
  <div class="card">
    <h3>Compare Two Messages, Offers, or Drafts (Exposes Walked-Back Commitments & Added Hedges)</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
      <textarea id="cmpLeft" rows="5" placeholder="Baseline / Earlier Statement (V1)...">We will sign the $120,000 agreement on Tuesday and kick off deployment on December 1.</textarea>
      <textarea id="cmpRight" rows="5" placeholder="Revised / Later Statement (V2)...">We might explore a pilot framework down the road subject to committee review when bandwidth allows.</textarea>
    </div>
    <button class="btn" onclick="runCompare()">Compare Logic & Commitment Shifts</button>
  </div>
  <div id="cmpOutput"></div>
</section>

<section id="tab-providers" class="view">
  <div class="note-warn">
    <strong>Note:</strong> Cannot be usefully used with ChatGPT, which has too many inbuilt prejudices for this kind of tool. Works with most other LLMs at the date of publishing (Anthropic Claude, Google Gemini, xAI Grok, DeepSeek, Mistral, OpenRouter, local Ollama models, CLI agents, plus the instant offline deterministic engine).
  </div>
  <div class="card">
    <h3>Configure Synthesis Providers (Stored Securely in macOS Keychain)</h3>
    <div id="provCards"></div>
  </div>
</section>

<section id="tab-agents" class="view">
  <div class="card">
    <div class="row-between" style="margin-bottom:12px;">
      <div>
        <h3 style="margin-bottom:4px;">REA-Style One-Click MCP & Skill Registration</h3>
        <div style="font-size:13px;color:var(--muted);">Connects this app's embedded native Universal <code>rel mcp</code> server and <code>SKILL.md</code> to your installed AI agents (zero Node.js required).</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn secondary" onclick="installCli()">Link 'rel' CLI to ~/.local/bin</button>
        <button class="btn" onclick="configureAllAgents()">Configure All Detected Agents</button>
      </div>
    </div>
    <div id="agentMsg" style="font-size:13px;color:var(--emerald);margin-bottom:10px;"></div>
    <div id="agentList"></div>
  </div>
</section>

<script>
const pending = new Map();
let seq = 0;
let CURRENT = null;

function callNative(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const reqId = "r_" + (++seq);
    pending.set(reqId, { resolve, reject });
    window.webkit.messageHandlers.relBridge.postMessage({ reqId, action, payload });
  });
}

window.__relResolve = function(reqId, ok, data) {
  const p = pending.get(reqId);
  if (!p) return;
  pending.delete(reqId);
  if (ok) p.resolve(data);
  else p.reject(new Error(String(data)));
};

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function switchTab(id, btn) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + id).classList.add("active");
  btn.classList.add("active");
  if (id === "providers" || id === "agents") refreshStatus();
}

function loadSample() {
  document.getElementById("msgInput").value = "We were blown away by your live demo on Tuesday, though our product committee feels integrating external partners before Q2 might create overlap with an internal initiative that was recently prioritized. Obviously we value our relationship and would hate to lose momentum, so if you can share your benchmark suite and latency numbers by Friday EOD, we can explore a pilot structure down the road when bandwidth allows.";
  document.getElementById("ctxInput").value = "VP of Platform at a potential acquirer writing to a startup founder 48 hours after an executive product demo.";
}

async function refreshStatus() {
  const st = await callNative("getStatus");
  const sel = document.getElementById("provSelect");
  const prev = sel.value || "auto";
  sel.innerHTML = '<option value="auto">Provider: Auto (Best Available)</option>' +
    st.providers.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + (p.available ? " [Ready]" : " [Needs Key]") + '</option>').join("");
  sel.value = prev;

  const keyProviders = [
    { id: "anthropic", label: "Anthropic Claude API Key (sk-ant-...)" },
    { id: "gemini", label: "Google Gemini API Key (AIza...)" },
    { id: "xai", label: "xAI Grok API Key (xai-...)" },
    { id: "deepseek", label: "DeepSeek API Key (sk-...)" },
    { id: "mistral", label: "Mistral API Key" },
    { id: "openrouter", label: "OpenRouter API Key (sk-or-...)" },
  ];

  document.getElementById("provCards").innerHTML = keyProviders.map(kp => {
    const info = st.providers.find(x => x.id === kp.id);
    const badge = info?.available ? '<span class="status-badge st-ok">CONFIGURED</span>' : '<span class="status-badge st-off">NOT SET</span>';
    return '<div style="display:grid;grid-template-columns:230px 1fr auto;gap:10px;align-items:center;margin-bottom:10px;">' +
      '<div><strong>' + esc(info?.name || kp.id) + '</strong><div style="margin-top:3px;">' + badge + '</div></div>' +
      '<input type="password" id="key_' + kp.id + '" placeholder="' + esc(kp.label) + '" />' +
      '<button class="btn secondary" onclick="saveKey(\'' + kp.id + '\')">Save to Keychain</button>' +
    '</div>';
  }).join("") +
  '<div style="display:grid;grid-template-columns:230px 1fr 1fr auto;gap:10px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--border);">' +
    '<div><strong>Ollama Local Runtime</strong></div>' +
    '<input id="ollama_host" value="' + esc(st.ollamaHost) + '" placeholder="http://127.0.0.1:11434" />' +
    '<input id="key_ollama" value="' + esc(st.ollamaModel) + '" placeholder="Model (e.g. llama3.3, qwen2.5:32b)" />' +
    '<button class="btn secondary" onclick="saveOllama()">Save Ollama</button>' +
  '</div>';

  document.getElementById("agentList").innerHTML = st.clients.map(c => {
    const b = c.configured ? '<span class="status-badge st-ok">CONFIGURED</span>'
      : c.detected ? '<span class="status-badge st-det">DETECTED</span>'
      : '<span class="status-badge st-off">NOT INSTALLED</span>';
    return '<div class="row-between" style="padding:10px 12px;background:var(--panel2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;">' +
      '<div><strong>' + esc(c.name) + '</strong> <span style="font-family:var(--mono);font-size:11.5px;color:var(--muted);">(' + esc(c.config_path) + ')</span></div>' +
      '<div style="display:flex;align-items:center;gap:10px;">' + b +
        '<button class="btn secondary" style="padding:5px 10px;font-size:12px;" onclick="configureSingleAgent(\'' + esc(c.id) + '\')">Configure</button>' +
      '</div></div>';
  }).join("");
}

async function saveKey(id) {
  const val = document.getElementById("key_" + id).value;
  await callNative("saveKey", { provider: id, key: val });
  document.getElementById("key_" + id).value = "";
  await refreshStatus();
}

async function saveOllama() {
  const host = document.getElementById("ollama_host").value;
  const model = document.getElementById("key_ollama").value;
  await callNative("saveKey", { provider: "ollama", host, key: model });
  await refreshStatus();
}

async function configureAllAgents() {
  const r = await callNative("configureAgents", { allDetected: true });
  document.getElementById("agentMsg").textContent = "Configured " + r.configured + " detected AI agent client(s) with native rel MCP server + SKILL.md.";
  await refreshStatus();
}

async function configureSingleAgent(clientId) {
  await callNative("configureAgents", { clientId });
  document.getElementById("agentMsg").textContent = "Configured " + clientId + " successfully.";
  await refreshStatus();
}

async function installCli() {
  const r = await callNative("installCliSymlink", {});
  document.getElementById("agentMsg").textContent = "Linked native CLI -> " + r.linked;
}

async function runAnalyze() {
  const text = document.getElementById("msgInput").value.trim();
  if (!text) return;
  const btn = document.getElementById("runBtn");
  btn.disabled = true;
  btn.textContent = "Decompiling...";
  try {
    const b = await callNative("analyze", {
      text,
      context: document.getElementById("ctxInput").value.trim(),
      provider: document.getElementById("provSelect").value || "auto"
    });
    CURRENT = b;
    renderXray(b);
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Reverse Engineer Logic";
  }
}

function renderXray(b) {
  document.getElementById("xrayResult").style.display = "block";
  document.getElementById("ledgerSummary").textContent =
    "100% Obligation Closure (" + b.completion_ledger.summary.pass + "/" + b.completion_ledger.summary.total + ") · Provider: " +
    b.exposition.provider_used.id + " · Ledger: " + b.completion_ledger.ledger_id.slice(0, 22) + "...";
  document.getElementById("execSubtext").textContent = b.exposition.global_architecture.executive_subtext_translation;

  document.getElementById("uList").innerHTML = b.decompilation.units.map(u => {
    const chips = u.signals.map(s => '<span class="chip">' + esc(s.code) + ': "' + esc(s.match) + '"</span>').join("");
    return '<div class="unit" data-kind="u" data-id="' + esc(u.unit_id) + '" onclick="pickUnit(\'u\',\'' + esc(u.unit_id) + '\')">' +
      '<div class="row-between" style="font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:4px;"><span style="color:var(--accent);font-weight:700;">' + esc(u.unit_id) + '</span><span>[' + u.span.start + '..' + u.span.end + '] · ' + esc(u.agency_and_commitment.commitment_profile) + '</span></div>' +
      '<div>' + esc(u.text) + '</div>' + (chips ? '<div>' + chips + '</div>' : '') + '</div>';
  }).join("");

  document.getElementById("oList").innerHTML = b.decompilation.conspicuous_omissions.map(o => {
    return '<div class="unit omission" data-kind="o" data-id="' + esc(o.omission_id) + '" onclick="pickUnit(\'o\',\'' + esc(o.omission_id) + '\')">' +
      '<div class="row-between" style="font-family:var(--mono);font-size:11px;color:var(--rose);margin-bottom:4px;"><b>' + esc(o.omission_id) + ' · SILENCE</b><span>' + esc(o.slot) + '</span></div>' +
      '<div><b>' + esc(o.title) + '</b></div></div>';
  }).join("");

  document.getElementById("aList").innerHTML = (b.exposition.global_architecture.actor_incentive_matrix || []).map(a =>
    '<div class="mbox" style="margin-bottom:8px;"><b style="color:var(--accent);font-size:12px;">' + esc(a.actor) + '</b>' +
    '<div><b>Stated:</b> ' + esc(a.stated_goal) + '</div>' +
    '<div style="margin-top:4px;"><b>Revealed Incentives:</b> ' + esc(a.revealed_incentives) + '</div>' +
    '<div style="margin-top:4px;"><b>Core Fears:</b> ' + esc(a.core_fears_or_aversions) + '</div>' +
    '<div style="margin-top:4px;"><b>Leverage & BATNA:</b> ' + esc(a.leverage_and_batna) + '</div></div>'
  ).join("");

  document.getElementById("pBody").innerHTML = (b.exposition.global_architecture.strategic_response_playbook || []).map(p =>
    '<div class="probe" style="margin-bottom:9px;"><div style="font-weight:700;color:var(--emerald);">' + esc(p.strategy_name) + '</div>' +
    '<div style="font-size:12px;color:var(--muted);margin:3px 0;">When: ' + esc(p.when_to_use) + '</div>' +
    '<div><b>Script / Move:</b> ' + esc(p.exact_move_or_script) + '</div></div>'
  ).join("");

  if (b.decompilation.units.length) pickUnit("u", b.decompilation.units[0].unit_id);
}

function pickUnit(kind, id) {
  document.querySelectorAll(".unit").forEach(el => el.classList.toggle("active", el.dataset.id === id));
  const body = document.getElementById("dBody");
  if (kind === "o") {
    const om = CURRENT.decompilation.conspicuous_omissions.find(x => x.omission_id === id);
    const exp = CURRENT.exposition.omission_expositions.find(x => x.omission_id === id);
    document.getElementById("dTitle").textContent = id + " - Conspicuous Omission Dossier";
    body.innerHTML =
      '<div class="sec"><div class="lbl">Omitted Slot</div><b>' + esc(om.title) + '</b></div>' +
      '<div class="sec"><div class="lbl">Why Expected in Candid Baseline</div>' + esc(exp.why_expected) + '</div>' +
      '<div class="sec"><div class="lbl">Strategic Benefit of Silence</div>' + esc(exp.strategic_function_of_silence) + '</div>' +
      '<div class="sec"><div class="lbl">Diagnostic Probe</div><div class="probe">' + esc(exp.diagnostic_probe) + '</div></div>';
    return;
  }
  const u = CURRENT.decompilation.units.find(x => x.unit_id === id);
  const exp = CURRENT.exposition.unit_expositions.find(x => x.unit_id === id);
  document.getElementById("dTitle").textContent = id + " - Complete Logic & Motivation Dossier";
  body.innerHTML =
    '<div class="sec"><div class="lbl">Verbatim</div><b>"' + esc(u.text) + '"</b></div>' +
    '<div class="sec"><div class="lbl">Operational Function (Real Job Performed)</div>' + esc(exp.operational_function) + '</div>' +
    '<div class="sec"><div class="lbl">Logic Chain</div><ul style="margin:4px 0;padding-left:18px;">' + (exp.logic_chain||[]).map(x => '<li>'+esc(x)+'</li>').join("") + '</ul></div>' +
    '<div class="sec"><div class="lbl">Hidden Premises</div><ul style="margin:4px 0;padding-left:18px;">' + (exp.hidden_premises||[]).map(x => '<li>'+esc(x)+'</li>').join("") + '</ul></div>' +
    '<div class="sec"><div class="lbl">Four-Layer Motivational Stack</div><div class="motive-grid">' +
      '<div class="mbox"><b>Surface Optics</b>' + esc(exp.motivational_stack.surface_motive) + '</div>' +
      '<div class="mbox"><b>Tactical Leverage</b>' + esc(exp.motivational_stack.tactical_motive) + '</div>' +
      '<div class="mbox"><b>Core Self-Interest</b>' + esc(exp.motivational_stack.core_self_interest) + '</div>' +
      '<div class="mbox"><b>Ego / Face Protection</b>' + esc(exp.motivational_stack.ego_or_face_protection) + '</div></div></div>' +
    '<div class="sec"><div class="lbl">Word-Choice Forensics</div>' + esc(exp.word_choice_forensics) + '</div>' +
    '<div class="sec"><div class="lbl">Counterfactual Candid Translation</div><div style="color:var(--amber);">' + esc(exp.counterfactual_translation) + '</div></div>' +
    '<div class="sec"><div class="lbl">Competing Hypotheses</div>' + (exp.hypotheses||[]).map(h => {
      const p = Math.round((h.probability || 0.33) * 100);
      return '<div class="mbox" style="margin-bottom:6px;"><div class="row-between"><span><b>' + esc(h.id) + ': ' + esc(h.label) + '</b></span><span>' + p + '%</span></div>' +
        '<div class="bar-bg"><div class="bar-fill" style="width:' + p + '%"></div></div><div style="color:var(--muted);">' + esc(h.rationale) + '</div></div>';
    }).join("") + '</div>' +
    '<div class="sec"><div class="lbl">Falsification Probe</div><div class="probe"><div><b>Ask / Do:</b> ' + esc(exp.diagnostic_probe?.probe_question_or_action || "") + '</div>' +
      '<div style="margin-top:4px;font-size:12px;"><b>If H1:</b> ' + esc(exp.diagnostic_probe?.if_h1_true_expect || "") + ' | <b>If H2:</b> ' + esc(exp.diagnostic_probe?.if_h2_true_expect || "") + '</div></div></div>';
}

async function exportBundle(kind) {
  if (!CURRENT) return;
  const content = kind === "json" ? JSON.stringify(CURRENT, null, 2) : (CURRENT.markdown_report || JSON.stringify(CURRENT, null, 2));
  await callNative("saveFile", { content, filename: kind === "json" ? "rel-evidence-bundle.json" : "rel-investigation-report.md" });
}

async function runCompare() {
  const left = document.getElementById("cmpLeft").value.trim();
  const right = document.getElementById("cmpRight").value.trim();
  if (!left || !right) return;
  const res = await callNative("compare", { left, right });
  const c = res.comparison;
  document.getElementById("cmpOutput").innerHTML =
    '<div class="card"><h3>Detected Behavioral & Framing Shifts (' + esc(res.evidence.evidence_id.slice(0,22)) + '...)</h3>' +
    c.behavioral_shifts.map(s => '<div class="banner"><b>' + esc(s.shift_kind) + ':</b> ' + esc(s.summary) + '</div>').join("") +
    '<h3>Micro-Signal Deltas</h3>' +
    (c.signal_deltas.length ? c.signal_deltas.map(d => '<div class="mbox" style="margin-bottom:7px;"><b>' + esc(d.signal_code) + ' (' + d.left_count + ' -> ' + d.right_count + ')</b>' + esc(d.interpretation) + '</div>').join("") : '<div>No micro-signal count change.</div>') +
    '</div>';
}

refreshStatus().then(loadSample);
</script>
</body>
</html>
"""#
}

@main
struct RelMacApp {
    static func main() {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = AppDelegate()
        app.delegate = delegate
        app.run()
    }
}
