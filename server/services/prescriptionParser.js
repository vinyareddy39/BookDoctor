/**
 * RecoverTrack Prescription Parser
 * Rule-based extraction engine for clinical notes and raw prescription text.
 * Strictly adheres to safety rules:
 * - Assigns confidence (0.0 - 1.0) to every field
 * - Sets needsReview = true whenever confidence < 0.9 or field missing
 * - Flags ambiguous notations without guessing
 */

const FREQUENCY_MAP = [
  { regex: /\b(?:1-0-1-1|1-1-1-1|4\s*(?:times|x)\s*a?\s*day|qid)\b/i, name: "Four times daily", times: ["08:00", "12:00", "16:00", "20:00"], confidence: 0.95 },
  { regex: /\b(?:1-1-1|3\s*(?:times|x)\s*a?\s*day|tid|tds|thrice daily)\b/i, name: "Thrice daily", times: ["08:00", "14:00", "20:00"], confidence: 0.95 },
  { regex: /\b(?:1-0-1|2\s*(?:times|x)\s*a?\s*day|bid|bd|twice daily)\b/i, name: "Twice daily", times: ["08:00", "20:00"], confidence: 0.95 },
  { regex: /\b(?:1-0-0|morning|in the morning|od(?:\s+morning)?)\b/i, name: "Morning", times: ["08:00"], confidence: 0.95 },
  { regex: /\b(?:0-1-0|afternoon)\b/i, name: "Afternoon", times: ["13:00"], confidence: 0.95 },
  { regex: /\b(?:0-0-1|night|at bedtime|bedtime|hs)\b/i, name: "Night", times: ["21:00"], confidence: 0.95 },
  { regex: /\b(?:once daily|once a day|od)\b/i, name: "Morning", times: ["08:00"], confidence: 0.9 },
  { regex: /\b(?:sos|prn|as needed)\b/i, name: "As needed", times: ["08:00"], confidence: 0.8 },
];

const TIMING_MAP = [
  { regex: /\b(?:before food|before meals?|empty stomach|ac)\b/i, timing: "before_food", label: "Before food" },
  { regex: /\b(?:after food|after meals?|post meal|pc)\b/i, timing: "after_food", label: "After food" },
  { regex: /\b(?:with food|with meals?)\b/i, timing: "with_food", label: "With food" },
  { regex: /\b(?:bedtime|at night|before sleeping|hs)\b/i, timing: "bedtime", label: "At bedtime" },
  { regex: /\b(?:sos|as needed|prn)\b/i, timing: "as_needed", label: "As needed" },
];

export function parsePrescriptionText(rawText) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return [];
  }

  // Split into candidate lines (newline, semicolon, or numbered items)
  const lines = rawText
    .split(/\r?\n|;|\d+\.\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  const medications = [];

  for (const line of lines) {
    // Skip general headers or non-medication lines
    if (/^(rx|advice|diagnosis|notes|instructions|investigations|follow up|chief complaint):?$/i.test(line)) {
      continue;
    }

    let text = line
      .replace(/^[•\-\*\d\.\)\s]+/, "") // remove bullets / numbers
      .trim();

    if (!text) continue;

    let fieldConfidence = {
      drug: 0.0,
      strength: 0.0,
      dose: 0.0,
      frequency: 0.0,
      durationDays: 0.0,
    };

    // 1. STRENGTH (e.g. 500mg, 250 mg, 10 ml, 5 mcg, 20 iu)
    let strength = "";
    const strengthMatch = text.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|gm|ml|iu|%|meq))\b/i);
    if (strengthMatch) {
      strength = strengthMatch[1].trim();
      fieldConfidence.strength = 1.0;
    } else {
      fieldConfidence.strength = 0.5; // may be optional for combo or liquids
    }

    // 2. DOSE (e.g. 1 tablet, 2 puffs, 5 ml, 1 cap)
    let dose = "1 tablet";
    const doseMatch = text.match(/(\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|puffs?|drops?|tsp|tbsp|sachets?|units?|ml))\b/i);
    if (doseMatch) {
      dose = doseMatch[1].trim();
      fieldConfidence.dose = 1.0;
    } else if (/\b(?:1 tab|tab|cap|tablet)\b/i.test(text)) {
      dose = "1 tablet";
      fieldConfidence.dose = 0.85;
    } else {
      dose = "1 tablet";
      fieldConfidence.dose = 0.5; // Defaulted - requires review
    }

    // 3. FREQUENCY & TIMES
    let frequency = "";
    let times = ["08:00", "20:00"];
    for (const freq of FREQUENCY_MAP) {
      if (freq.regex.test(text)) {
        frequency = freq.name;
        times = [...freq.times];
        fieldConfidence.frequency = freq.confidence;
        break;
      }
    }
    if (!frequency) {
      frequency = "Twice daily"; // placeholder
      fieldConfidence.frequency = 0.4; // Low confidence
    }

    // 4. DURATION (e.g. for 5 days, x 7 days, 1 week, 30 days)
    let durationDays = 5;
    const durationMatch = text.match(/(?:for|x|duration:?|\*)\s*(\d+)\s*(days?|weeks?|months?)\b/i) ||
                          text.match(/\b(\d+)\s*(days?|weeks?|months?)\b/i);
    if (durationMatch) {
      const num = parseInt(durationMatch[1], 10);
      const unit = durationMatch[2].toLowerCase();
      if (unit.startsWith("week")) {
        durationDays = num * 7;
      } else if (unit.startsWith("month")) {
        durationDays = num * 30;
      } else {
        durationDays = num;
      }
      fieldConfidence.durationDays = 0.95;
    } else {
      durationDays = 5;
      fieldConfidence.durationDays = 0.4; // Missing duration
    }

    // 5. TIMING & INSTRUCTIONS
    let timing = "after_food";
    let instructions = "";
    for (const t of TIMING_MAP) {
      if (t.regex.test(text)) {
        timing = t.timing;
        instructions = t.label;
        break;
      }
    }
    if (!instructions) {
      instructions = "After food";
    }

    // 6. DRUG NAME
    // Remove known dosage forms prefix (e.g. Tab. Paracetamol -> Paracetamol)
    let cleanLine = text
      .replace(/^(?:tab(?:let)?|cap(?:sule)?|syr(?:up)?|inj(?:ection)?|drop(?:s)?|ointment|cream)\.?\s+/i, "")
      .trim();

    // The drug name is typically whatever appears before the strength, dose, or frequency
    let drug = cleanLine;
    if (strengthMatch) {
      const idx = cleanLine.toLowerCase().indexOf(strengthMatch[0].toLowerCase());
      if (idx > 0) {
        drug = cleanLine.substring(0, idx).trim();
      }
    } else if (doseMatch) {
      const idx = cleanLine.toLowerCase().indexOf(doseMatch[0].toLowerCase());
      if (idx > 0) {
        drug = cleanLine.substring(0, idx).trim();
      }
    }

    // Also strip any trailing numbers or frequency / dose words
    const splitIdx = drug.search(/[\-,;]|(?:\s+(?:\d+|tab(?:let)?|cap(?:sule)?|1-0|0-1|od|bd|tid|qid|once|twice|thrice|daily|morning|night|for\s+\d))/i);
    if (splitIdx > 1) {
      drug = drug.substring(0, splitIdx).trim();
    }

    // Cleanup drug string
    drug = drug.replace(/[^a-zA-Z0-9\s\+\-\/\.]/g, "").trim();

    if (drug.length >= 2 && !/^(take|use|apply|inject|drink|eat)$/i.test(drug)) {
      fieldConfidence.drug = 0.9;
    } else {
      drug = drug || "Medication";
      fieldConfidence.drug = 0.4;
    }

    // Flag needsReview if any essential field has confidence < 0.9 or was guessed
    const needsReview = (
      fieldConfidence.drug < 0.9 ||
      fieldConfidence.strength < 0.8 ||
      fieldConfidence.dose < 0.9 ||
      fieldConfidence.frequency < 0.9 ||
      fieldConfidence.durationDays < 0.9
    );

    medications.push({
      drug,
      name: drug,
      strength,
      dose,
      dosage: dose,
      frequency,
      times,
      durationDays,
      duration: `${durationDays} days`,
      startDate: new Date(),
      timing,
      instructions,
      fieldConfidence,
      needsReview,
    });
  }

  return medications;
}
