import { describe, it, expect } from "@jest/globals";

// Helper function modeling the appointment conflict detection implemented in Phase 3
function detectAppointmentConflict({ existingAppointments, doctorLeaves, requestedDate, requestedTime, durationMinutes = 30 }) {
  const reqStart = new Date(`${requestedDate}T${requestedTime}`);
  const reqEnd = new Date(reqStart.getTime() + durationMinutes * 60 * 1000);

  // 1. Check if date falls during approved doctor leave
  const isOnLeave = doctorLeaves.some((leave) => {
    if (leave.status !== "approved") return false;
    const leaveStart = new Date(leave.startDate);
    const leaveEnd = new Date(leave.endDate);
    leaveStart.setHours(0, 0, 0, 0);
    leaveEnd.setHours(23, 59, 59, 999);
    return reqStart >= leaveStart && reqStart <= leaveEnd;
  });

  if (isOnLeave) {
    return { hasConflict: true, reason: "doctor_on_leave" };
  }

  // 2. Check double booking / overlapping slot
  const isDoubleBooked = existingAppointments.some((appt) => {
    if (appt.status === "cancelled" || appt.status === "no-show") return false;
    const apptStart = new Date(`${appt.appointmentDate}T${appt.appointmentTime}`);
    const apptEnd = new Date(apptStart.getTime() + (appt.durationMinutes || 30) * 60 * 1000);

    // Overlap condition: reqStart < apptEnd && reqEnd > apptStart
    return reqStart < apptEnd && reqEnd > apptStart;
  });

  if (isDoubleBooked) {
    return { hasConflict: true, reason: "slot_conflict_double_booking" };
  }

  return { hasConflict: false };
}

describe("Phase 3 Appointment Conflict & Doctor Leave Detection Tests", () => {
  const mockLeaves = [
    {
      startDate: "2026-10-15",
      endDate: "2026-10-20",
      status: "approved",
      reason: "Annual medical conference",
    },
    {
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      status: "pending", // Pending leave should NOT block booking
      reason: "Personal leave",
    },
  ];

  const mockExistingAppointments = [
    {
      appointmentDate: "2026-10-10",
      appointmentTime: "10:00:00",
      durationMinutes: 30,
      status: "confirmed",
    },
    {
      appointmentDate: "2026-10-10",
      appointmentTime: "11:30:00",
      durationMinutes: 30,
      status: "confirmed",
    },
    {
      appointmentDate: "2026-10-10",
      appointmentTime: "14:00:00",
      durationMinutes: 30,
      status: "cancelled", // Cancelled slot SHOULD be available
    },
  ];

  it("should detect exact slot collision (double booking)", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-10-10",
      requestedTime: "10:00:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe("slot_conflict_double_booking");
  });

  it("should detect overlapping slot collision (starts before existing ends)", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-10-10",
      requestedTime: "10:15:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe("slot_conflict_double_booking");
  });

  it("should ALLOW booking if previous appointment is cancelled", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-10-10",
      requestedTime: "14:00:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(false);
  });

  it("should BLOCK booking if date falls during doctor approved leave", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-10-16",
      requestedTime: "10:00:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.reason).toBe("doctor_on_leave");
  });

  it("should ALLOW booking when leave request is still pending", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-11-02",
      requestedTime: "10:00:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(false);
  });

  it("should ALLOW booking on non-overlapping vacant slot", () => {
    const result = detectAppointmentConflict({
      existingAppointments: mockExistingAppointments,
      doctorLeaves: mockLeaves,
      requestedDate: "2026-10-10",
      requestedTime: "10:30:00",
      durationMinutes: 30,
    });

    expect(result.hasConflict).toBe(false);
  });
});
