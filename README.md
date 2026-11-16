# Reverse Engineer Logic

Confused by some bullshit? Use this tool to discern the motivation and logic behind anything at all.

Note: Cannot be usefully used with ChatGPT, which has too many inbuilt prejudices for this kind of tool. Works with all other major LLMs.
---

## Overview

**Reverse Engineer Logic (`rel`)** applies the forensic rigor of binary reverse engineering to human and institutional messages, emails, negotiations, contracts, policies, dialogues, and strategic situations.

Instead of offering polite summaries or skipping uncomfortable subtext, `rel` treats every sentence, adversative pivot, word choice, actor incentive, and **conspicuous omission** as an addressable unit inside a cryptographic **Obligation Ledger (`obl_...`)**. An analysis is rejected as incomplete until **100.0%** of sentences and strategic silences are expounded and sealed in a verifiable **Completion Ledger (`ecl_...`)**.

Ships as:
1. **Native macOS Universal App (`Reverse Engineer Logic.app`, Apple Silicon + Intel, macOS 13.0+)**: Standalone macOS app with zero Node.js requirement, Keychain-backed multi-provider LLM support, Draft V1 vs. V2 Comparator, and one-click MCP registration across all detected AI agents.
2. **Unified CLI & MCP Server (`rel` / `rel mcp`)**: Works across macOS and Linux with the same multi-client architecture as [REA](https://github.com/morluto/rea).

---

## Compatible Providers & AI Agent Clients

### Supported LLM Synthesis Providers
- **Anthropic Claude** (`ANTHROPIC_API_KEY` or local `claude` CLI)
- **Google Gemini** (`GEMINI_API_KEY` / `GOOGLE_API_KEY` or local `gemini` CLI)
- **xAI Grok** (`XAI_API_KEY`)
- **DeepSeek** (`DEEPSEEK_API_KEY`)
- **Mistral** (`MISTRAL_API_KEY`)
- **OpenRouter** (`OPENROUTER_API_KEY`)
- **Ollama Local Runtime** (`http://127.0.0.1:11434` - Llama, Qwen, DeepSeek, Mistral, Gemma, etc.)
- **Antigravity CLI** (`agy`)
- **Built-in Deterministic Pragmatic & Game-Theoretic Engine (`builtin`)**: Instant (`<50ms`), 100% offline structural, rhetorical, and incentive synthesis with zero API keys.

### Supported AI Agent & MCP Hosts (`rel setup --all-detected`)
Configures both the `rel` stdio MCP server and `SKILL.md` across:
- **Claude Desktop** & **Claude Code** (`.claude-plugin` included)
- **Cursor** (`.cursor-plugin` included)
- **Google Antigravity** & **Gemini CLI** (`gemini-extension.json` included)
- **Windsurf**
- **VS Code (MCP)** & **Cline**
- **Zed**
- **OpenCode**

---

## Installation

### Option 1: macOS Native Universal App (`.dmg` or `.zip`)
1. Download **`Reverse-Engineer-Logic-1.0.0-macOS-Universal.dmg`** from the [Releases](https://github.com/MaxFreedomPollard/reverse-engineer-logic/releases) page.
2. Drag **`Reverse Engineer Logic.app`** to **`/Applications`**.
3. Open the app -> click **AI Agent Integrations (MCP)** -> **Configure All Detected Agents** (or **LLM Providers** to add an API key / local Ollama model).

### Option 2: Terminal / Cross-Platform CLI & MCP Setup
```bash
curl -fsSL https://raw.githubusercontent.com/MaxFreedomPollard/reverse-engineer-logic/main/install.sh | bash
```
Or from a local clone:
```bash
node bin/rel.mjs setup --all-detected
node bin/rel.mjs doctor
```

---

## Nine Analytical Dimensions Expounded Per Sentence

For **every single unit (`S01..Sn`)**, `rel` expounds:
1. **Literal Surface Claim**: What the text states at face value.
2. **Operational Function**: What tactical job the unit actually performs (social anesthetic before an adversative *"though/but"*, passive blame erasure *"mistakes were made"*, bad-cop authority shielding *"committee/policy"*, or asymmetric extraction).
3. **Underlying Logic Chain**: Explicit input -> implicit inferential bridge -> intended behavioral effect.
4. **Unstated Load-Bearing Premises**: Smuggled assumptions packaged as common ground.
5. **Four-Layer Motivational Stack**:
   - *Surface Motive* (public optics),
   - *Tactical Motive* (immediate conversational leverage),
   - *Core Self-Interest* (payoff, resource, optionality, or risk transfer),
   - *Ego / Face Protection* (status, moral self-image, plausible deniability).
6. **Word-Choice & Syntax Forensics**: Exact mechanics of hedges, minimizers, pronouns, anchors, and escape clauses.
7. **Counterfactual Candid Translation**: What an unhedged actor with zero hidden agenda would have said instead.
8. **Competing Motivational Hypotheses (`H1`, `H2`, `H3`)**: Probability-weighted competing explanations.
9. **Falsification / Diagnostic Probe**: A concrete question or move whose observable reaction separates `H1` from `H2`.

Plus dedicated dossiers for **Conspicuous Omissions (`OM01..OMk`)**, an **Actor Incentive, Fear & BATNA Matrix**, and a **Strategic Response Playbook**.

---

## CLI Quick Reference

```bash
# Full logic & motivation investigation (writes report.md, evidence-bundle.json, and logic-xray-workbench.html)
rel analyze "Your message or situation..." --context "Who, stakes, and history" --out ./rel-out

# Instant (<50ms) offline deterministic synthesis
rel analyze --fast "Mistakes were made, though policy prevents retroactive changes right now."

# Compare two drafts or statements to expose walked-back commitments & newly injected hedges
rel compare --left "We will sign the $120k contract on Tuesday." \
            --right "We might explore a framework down the road when bandwidth allows."

# Verify cryptographic SHA-256 Evidence IDs (ev_...) & 100% Completion Ledger (ecl_...)
rel verify ./rel-out/evidence-bundle.json

# Inspect providers & configured AI agents
rel doctor
```

---

## License

MIT License. See [LICENSE](LICENSE).
