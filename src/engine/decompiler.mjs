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
export function segmentIntoUnits(rawText) {
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
export function detectConspicuousOmissions(rawText, units, contextText = "") {
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
export function decompileSubject(subject, rawText) {
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
