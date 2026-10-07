import { describe, it, expect } from "@jest/globals";
import { authorize, checkPermission, PERMISSIONS, ROLES } from "../middleware/rbac.js";

describe("Phase 1 RBAC & Permission Matrix Tests", () => {
  it("should contain all 5 system roles in ROLES definition", () => {
    expect(ROLES).toContain("clinic_admin");
    expect(ROLES).toContain("doctor");
    expect(ROLES).toContain("receptionist");
    expect(ROLES).toContain("lab_technician");
    expect(ROLES).toContain("patient");
  });

  it("should allow doctor and clinic_admin to read and write clinical notes", () => {
    expect(checkPermission("doctor", "clinical_note", "read")).toBe(true);
    expect(checkPermission("doctor", "clinical_note", "create")).toBe(true);
    expect(checkPermission("clinic_admin", "clinical_note", "read")).toBe(true);
  });

  it("should STRICTLY DENY receptionists and lab technicians from reading clinical notes", () => {
    expect(checkPermission("receptionist", "clinical_note", "read")).toBe(false);
    expect(checkPermission("receptionist", "clinical_note", "create")).toBe(false);
    expect(checkPermission("lab_technician", "clinical_note", "read")).toBe(false);
    expect(checkPermission("lab_technician", "clinical_note", "create")).toBe(false);
  });

  it("should allow lab technicians to read, enter, and verify lab orders and results", () => {
    expect(checkPermission("lab_technician", "lab_order", "read")).toBe(true);
    expect(checkPermission("lab_technician", "lab_order", "update")).toBe(true);
  });

  it("should allow receptionists to register walk-ins and book appointments", () => {
    expect(checkPermission("receptionist", "appointment", "create")).toBe(true);
    expect(checkPermission("receptionist", "patient_profile", "create")).toBe(true);
  });

  it("should allow clinic_admin universal permission across all clinic resources", () => {
    expect(checkPermission("clinic_admin", "audit_log", "read")).toBe(true);
    expect(checkPermission("clinic_admin", "billing", "create")).toBe(true);
  });

  it("should invoke next() when user role has permission for resource action in middleware", () => {
    const middleware = authorize("clinical_note", "create");
    let nextCalled = false;
    const req = { user: { role: "doctor" } };
    const res = {};
    const next = () => { nextCalled = true; };

    middleware(req, res, next);
    expect(nextCalled).toBe(true);
  });

  it("should return 403 when user role is not permitted for the resource action", () => {
    const middleware = authorize("clinical_note", "read");
    let nextCalled = false;
    let responseStatus = null;
    let responseBody = null;

    const req = { user: { role: "receptionist" } };
    const res = {
      status: (code) => {
        responseStatus = code;
        return {
          json: (body) => { responseBody = body; },
        };
      },
    };
    const next = () => { nextCalled = true; };

    middleware(req, res, next);
    expect(nextCalled).toBe(false);
    expect(responseStatus).toBe(403);
    expect(responseBody.success).toBe(false);
  });
});
