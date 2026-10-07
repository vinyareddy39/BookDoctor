import { describe, it, expect } from "@jest/globals";
import { redactPII, generateVisitSummary, generatePatientExplanation } from "../services/aiService.js";

describe("Phase 8 AI Safety Guardrails & Fallback Tests", () => {
  it("should redact personal email addresses and replace with [REDACTED_EMAIL]", () => {
    const raw = "Patient email is john.doe@medclinic.org and alt is mary123@gmail.com";
    const cleaned = redactPII(raw);

    expect(cleaned).not.toContain("john.doe@medclinic.org");
    expect(cleaned).not.toContain("mary123@gmail.com");
    expect(cleaned).toContain("[REDACTED_EMAIL]");
  });

  it("should redact phone numbers and replace with [REDACTED_PHONE]", () => {
    const raw = "Call patient at +91 9849512453 or home at 9876543210 immediately";
    const cleaned = redactPII(raw);

    expect(cleaned).not.toContain("9849512453");
    expect(cleaned).not.toContain("9876543210");
    expect(cleaned).toContain("[REDACTED_PHONE]");
  });

  it("should redact medical record numbers (MRNs) matching pattern MED-YYYY-XXXXX", () => {
    const raw = "Patient registered under chart MED-2026-00042 in clinic system";
    const cleaned = redactPII(raw);

    expect(cleaned).not.toContain("MED-2026-00042");
    expect(cleaned).toContain("[REDACTED_MRN]");
  });

  it("should generate structured visit summary draft with clinician review flags", async () => {
    const draft = await generateVisitSummary({
      chiefComplaint: "Persistent dry cough for 3 weeks",
      history: "No fever, non-smoker, mild seasonal allergies",
      vitals: { bloodPressure: "120/80", heartRate: 72, temperature: 98.6 },
      assessment: "Post-viral bronchial hyperreactivity",
      plan: "Inhaled bronchodilator for 5 days, steam inhalation",
      diagnoses: [{ code: "J45.909", label: "Unspecified asthma" }],
    });

    expect(draft).toBeDefined();
    expect(draft.summary).toBeDefined();
    expect(typeof draft.summary).toBe("string");
    expect(draft.status).toBe("draft");
    expect(draft.disclaimer).toContain("CLINICIAN REVIEW ONLY");
  });

  it("should produce plain-language patient explanations with mandatory safety disclaimers", async () => {
    const explanation = await generatePatientExplanation({
      medicines: [
        {
          name: "Amoxicillin 500mg",
          dosage: "1 capsule",
          frequency: "1-0-1",
          duration: "7 days",
          timing: "after_food",
          instructions: "Complete entire antibiotic course even if feeling better",
        },
      ],
      lifestyleAdvice: "Drink plenty of water and rest adequately",
    });

    expect(explanation).toBeDefined();
    expect(explanation.explanation).toBeDefined();
    expect(explanation.disclaimer).toBeDefined();
    // Safety check: must contain educational disclaimer
    expect(explanation.disclaimer).toContain("Educational plain-language summary only");
  });
});
