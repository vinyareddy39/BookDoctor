import { describe, it, expect } from "@jest/globals";

// Valid status transitions from Phase 5
const VALID_LAB_TRANSITIONS = {
  ordered: ["sample_collected", "cancelled"],
  sample_collected: ["processing", "cancelled"],
  processing: ["result_entered", "cancelled"],
  result_entered: ["verified", "cancelled"],
  verified: ["released"],
  released: [],
  cancelled: [],
};

function isValidLabTransition(currentStatus, nextStatus) {
  const allowed = VALID_LAB_TRANSITIONS[currentStatus];
  return allowed ? allowed.includes(nextStatus) : false;
}

function verifyLabResult({ entryUserId, verifyingUserId, resultStatus }) {
  if (resultStatus !== "result_entered") {
    return { success: false, message: "Result must be in result_entered state to verify" };
  }
  if (String(entryUserId) === String(verifyingUserId)) {
    return { success: false, message: "Dual-verifier policy violation: Verifier cannot be the same user who entered the result" };
  }
  return { success: true };
}

function maskLabOrderForPatient(order, userRole) {
  if (userRole === "patient" && order.status !== "released") {
    const masked = { ...order };
    delete masked.labResultId;
    masked.isResultMasked = true;
    return masked;
  }
  return order;
}

describe("Phase 5 Diagnostic Lab Workflow & Dual-Verifier Policy Tests", () => {
  it("should enforce sequential status transition from ordered to sample_collected", () => {
    expect(isValidLabTransition("ordered", "sample_collected")).toBe(true);
    expect(isValidLabTransition("sample_collected", "processing")).toBe(true);
    expect(isValidLabTransition("processing", "result_entered")).toBe(true);
    expect(isValidLabTransition("result_entered", "verified")).toBe(true);
    expect(isValidLabTransition("verified", "released")).toBe(true);
  });

  it("should REJECT invalid status transitions and skipping stages", () => {
    expect(isValidLabTransition("ordered", "released")).toBe(false);
    expect(isValidLabTransition("ordered", "verified")).toBe(false);
    expect(isValidLabTransition("processing", "released")).toBe(false);
    expect(isValidLabTransition("released", "processing")).toBe(false);
  });

  it("should allow cancellation from early stages but not after release", () => {
    expect(isValidLabTransition("ordered", "cancelled")).toBe(true);
    expect(isValidLabTransition("processing", "cancelled")).toBe(true);
    expect(isValidLabTransition("released", "cancelled")).toBe(false);
  });

  it("should REJECT verification if the verifier is the same technician who entered results", () => {
    const techId = "user_tech_123";
    const verification = verifyLabResult({
      entryUserId: techId,
      verifyingUserId: techId,
      resultStatus: "result_entered",
    });

    expect(verification.success).toBe(false);
    expect(verification.message).toContain("Dual-verifier policy violation");
  });

  it("should APPROVE verification when dual-verifier policy is satisfied by two distinct technicians", () => {
    const entryTechId = "user_tech_123";
    const secondTechId = "user_tech_456";

    const verification = verifyLabResult({
      entryUserId: entryTechId,
      verifyingUserId: secondTechId,
      resultStatus: "result_entered",
    });

    expect(verification.success).toBe(true);
  });

  it("should mask lab results for patient users until the requisition status reaches released", () => {
    const unreleasedOrder = {
      orderNumber: "LAB-2026-0001",
      status: "verified",
      labResultId: { hemoglobin: "14.2 g/dL" },
    };

    const patientView = maskLabOrderForPatient(unreleasedOrder, "patient");
    expect(patientView.labResultId).toBeUndefined();
    expect(patientView.isResultMasked).toBe(true);

    const releasedOrder = {
      orderNumber: "LAB-2026-0001",
      status: "released",
      labResultId: { hemoglobin: "14.2 g/dL" },
    };

    const releasedPatientView = maskLabOrderForPatient(releasedOrder, "patient");
    expect(releasedPatientView.labResultId).toBeDefined();
    expect(releasedPatientView.isResultMasked).toBeUndefined();
  });
});
