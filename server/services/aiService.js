import "dotenv/config";

// ── PII REDACTION ENGINE ──────────────────────────────────────────────────
/**
 * Redacts unnecessary Protected Health Information (PHI/PII) before sending data to AI.
 * Strips phone numbers, email addresses, MRNs, and replaces identifiers with anonymized tokens.
 */
export const redactPII = (text = "") => {
  if (typeof text !== "string") return text;

  return text
    // Redact email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]")
    // Redact 10-12 digit phone numbers
    .replace(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[REDACTED_PHONE]")
    // Redact MRN codes (e.g. MED-2026-00012)
    .replace(/MED-\d{4}-\d{5}/gi, "[REDACTED_MRN]")
    // Redact Aadhaar/National ID numbers (12 digits)
    .replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, "[REDACTED_GOV_ID]");
};

// ── CALL ANTHROPIC CLAUDE MESSAGES API ─────────────────────────────────────
export const callAnthropicAPI = async ({ systemPrompt, userMessage, maxTokens = 1000 }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022";

  // Check if API key is configured
  if (!apiKey) {
    console.warn("⚠️ [AI Service] ANTHROPIC_API_KEY not configured in environment. Using rule-based fallback.");
    return null; // Signals fallback mode
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[AI Service] Anthropic API HTTP ${response.status}:`, errBody);
      return null;
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";
    return content.trim();
  } catch (err) {
    clearTimeout(timeoutId);
    console.error("[AI Service] Network or timeout error connecting to Anthropic:", err.message);
    return null; // Triggers fallback
  }
};

// ── 1. GENERATE CLINICAL VISIT SUMMARY ─────────────────────────────────────
export const generateVisitSummary = async ({
  chiefComplaint = "",
  history = "",
  vitals = {},
  examination = "",
  assessment = "",
  plan = "",
  diagnoses = [],
}) => {
  const systemPrompt = `You are a clinical documentation assistant supporting physicians in an outpatient clinic.
Your task is to synthesize the provided structured visit notes into a concise, professional clinical summary.

GUIDELINES:
1. Organize your summary into 3 clear sections:
   - CLINICAL IMPRESSION: Brief synopsis of presenting illness and working diagnoses.
   - KEY FINDINGS & VITALS: Salient examination notes and vitals deviations.
   - TREATMENT & NEXT STEPS: Summary of management plan and follow-up.
2. Maintain objective medical terminology.
3. Keep the total output under 250 words.
4. DO NOT make definitive diagnoses that are not in the note.
5. Prefix the summary with "[AI-GENERATED CLINICAL DRAFT - PENDING PHYSICIAN REVIEW]"`;

  const vitalsText = vitals && Object.keys(vitals).length > 0
    ? `BP: ${vitals.bloodPressure || "-"}, HR: ${vitals.heartRate || "-"} bpm, Temp: ${vitals.temperature || "-"} F, SpO2: ${vitals.spO2 || "-"}%, BMI: ${vitals.bmi || "-"}`
    : "Vitals: Not recorded";

  const diagText = diagnoses.map((d) => `${d.code} (${d.label})`).join(", ");

  const rawInput = `
Chief Complaint: ${chiefComplaint}
History: ${history}
Vitals: ${vitalsText}
Physical Examination: ${examination}
Assessment: ${assessment}
Plan: ${plan}
Working Diagnoses: ${diagText || "None specified"}
  `.trim();

  const redactedInput = redactPII(rawInput);
  const aiOutput = await callAnthropicAPI({
    systemPrompt,
    userMessage: redactedInput,
    maxTokens: 600,
  });

  if (aiOutput) {
    return {
      summary: aiOutput,
      isAiGenerated: true,
      modelUsed: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet",
      status: "draft",
      disclaimer: "AI-generated draft for CLINICIAN REVIEW ONLY. Must be reviewed, edited, and approved by the attending physician before entering official medical record.",
    };
  }

  // Graceful Rule-Based Fallback
  const fallbackSummary = `[CLINICAL VISIT SUMMARY - SYSTEM GENERATED DRAFT]
• Clinical Impression: Patient presented with ${chiefComplaint || "general medical inquiry"}.${assessment ? ` Assessment: ${assessment}.` : ""}
• Objective Findings: ${vitalsText}.${examination ? ` Exam: ${examination}.` : ""}
• Diagnoses: ${diagText || "Clinical evaluation pending"}
• Plan & Management: ${plan || "Symptomatic treatment and monitoring."}`;

  return {
    summary: fallbackSummary,
    isAiGenerated: false,
    modelUsed: "offline-fallback-engine",
    status: "draft",
    disclaimer: "Offline generated draft for CLINICIAN REVIEW ONLY. Attending physician must approve.",
  };
};

// ── 2. GENERATE PATIENT PLAIN-LANGUAGE EXPLANATION ─────────────────────────
export const generatePatientExplanation = async ({
  medicines = [],
  followUpPlan = "",
  lifestyleAdvice = "",
}) => {
  const systemPrompt = `You are a compassionate, patient-friendly medical communicator assisting patients in understanding their care plan.

STRICT MEDICAL SAFETY GUARDRAILS:
1. DO NOT diagnose or speculate on any condition.
2. DO NOT change, adjust, or suggest altering any medication dosage, frequency, or duration.
3. DO NOT offer any new medical advice.
4. Explain in simple, clear language (reading age 12):
   - What each medicine is commonly used for.
   - When to take it (e.g. before meals, after food, morning vs bedtime).
   - Practical tips (e.g. drink plenty of water, do not skip doses).
5. Explain the follow-up timeline in plain terms.
6. MANDATORY CLOSING: Always conclude with the exact text:
   "⚠️ IMPORTANT: This explanation is for educational purposes only. Do not stop or change medications without consulting your doctor. If you experience worsening symptoms or unexpected reactions, contact your clinic immediately."`;

  const medDescriptions = medicines
    .map((m, idx) => `${idx + 1}. ${m.name} (${m.dosage}) - ${m.frequency || "as directed"} for ${m.duration || "course"}. Instructions: ${m.instructions || "as prescribed"}`)
    .join("\n");

  const rawInput = `
Prescribed Medications:
${medDescriptions || "No medications prescribed."}

Follow-up Consultation Plan:
${followUpPlan || "Routine follow-up as discussed with doctor."}

Lifestyle & Home Care Advice:
${lifestyleAdvice || "Rest, hydration, and healthy nutrition."}
  `.trim();

  const redactedInput = redactPII(rawInput);
  const aiOutput = await callAnthropicAPI({
    systemPrompt,
    userMessage: redactedInput,
    maxTokens: 800,
  });

  if (aiOutput) {
    return {
      explanation: aiOutput,
      isAiGenerated: true,
      modelUsed: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet",
      disclaimer: "Educational plain-language summary only. Never replace physician consultation.",
    };
  }

  // Graceful Rule-Based Fallback
  let fallback = "Here is a simplified guide to your prescribed care plan:\n\n";
  if (medicines.length > 0) {
    fallback += "💊 Medications:\n";
    medicines.forEach((m) => {
      fallback += `• ${m.name}: Take ${m.dosage || "prescribed amount"} (${m.frequency || "regularly"}) for ${m.duration || "prescribed duration"}. ${m.instructions ? `Note: ${m.instructions}` : "Take as directed by doctor."}\n`;
    });
    fallback += "\n";
  }
  if (followUpPlan) {
    fallback += `🗓️ Follow-up: ${followUpPlan}\n\n`;
  }
  fallback += "⚠️ IMPORTANT: This explanation is for educational purposes only. Do not stop or change medications without consulting your doctor. If you experience worsening symptoms or unexpected reactions, contact your clinic immediately.";

  return {
    explanation: fallback,
    isAiGenerated: false,
    modelUsed: "offline-fallback-engine",
    disclaimer: "Educational plain-language summary only. Never replace physician consultation.",
  };
};
