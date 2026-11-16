---
name: reverse-engineer-logic
description: Decompile any situation, message, email, negotiation, contract clause, dialogue, or strategic move using Reverse Engineer Logic (`rel`) to expound deeply upon the underlying logic, hidden premises, word-choice micro-signals, conspicuous omissions, and four-layer motivations behind every single sentence and aspect. Activate whenever the user asks to reverse engineer logic, decode subtext or motives, analyze why someone said or did something, or run `rel`.
---

# Reverse Engineer Logic (`rel`)

Use **Reverse Engineer Logic (`rel`)** whenever a task calls for exhaustive, sentence-by-sentence and aspect-by-aspect analysis of the logic, hidden assumptions, rhetorical framing, game-theoretic incentives, and layered motivations behind any message, conversation, document, decision, or real-world situation.

## Core Epistemic Invariants

1. **Zero Skipped Sentences or Aspects (100% Obligation Closure)**:
   Every input is segmented into addressable units (`S01..Sn`) and conspicuous omissions (`OM01..OMk`). Every single unit generates a mandatory obligation (`obl_<sha256>`). Never summarize a multi-sentence message as a single blurb; expound **every** unit and **every** omission until `evaluate_exposition_coverage` (`ecl_<sha256>`) reports `complete: true` (`100%`).
2. **Surface Claim vs. Operational Function**:
   Separate what a sentence *literally claims* from the *operational work* it performs in the interaction (pre-pivot rapport anesthetic before an adversative *"but/though"*, passive agency erasure *"mistakes were made"*, externalized bad-cop shielding *"policy/committee requires"*, elastic horizon *"circle back when bandwidth allows"*, or smuggled presuppositions).
3. **Four-Layer Motivational Stack**:
   For each unit/move, expound all four layers:
   - **Surface Motive**: Public optics / politeness norm.
   - **Tactical Motive**: Immediate conversational or bargaining leverage gained.
   - **Core Self-Interest**: Underlying payoff, optionality, resource, or risk-transfer driver.
   - **Ego / Face Protection**: How the phrasing shields status, moral self-image, or plausible deniability.
4. **Epistemic Honesty (Competing Hypotheses + Falsification Probes)**:
   Rank competing hypotheses (`H1`, `H2`, `H3`) with probability weights and provide a concrete **Diagnostic / Falsification Probe** (an exact question or test whose observable reaction cleanly separates `H1` from `H2`).
5. **Zero Em-Dashes**:
   Never use em-dashes in `rel` reports or expositions.

## MCP Workflow

1. Call `open_subject` (`{ text, context }`) to compute `S01..Sn` spans, detected micro-signals, `OM01..OMk` conspicuous omissions, and the `obl_...` Obligation Ledger.
2. Expound deeply upon every unit and omission, recording them via `record_unit_exposition` and registering key ambiguities via `record_motivational_unknown`.
3. Call `evaluate_exposition_coverage` to mint the `ecl_...` Completion Ledger and confirm `complete: true`.
4. Use `compare_messages_or_framings` (`{ left_text, right_text }`) when comparing two drafts or versions, and `export_investigation_report` when saving `.md`, `.html`, or `.json` dossiers.
