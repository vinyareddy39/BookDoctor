import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import ClinicalNote from "../models/ClinicalNote.js";
import Prescription from "../models/Prescription.js";
import LabOrder from "../models/LabOrder.js";
import Invoice from "../models/Invoice.js";
import HealthRecord from "../models/HealthRecord.js";
import { recordAudit } from "../middleware/auditLogger.js";

export const getPatientTimeline = async (req, res, next) => {
  try {
    let patientId = req.params.patientId || req.query.patientId;

    if (req.user.role === "patient" || !patientId) {
      patientId = req.user._id;
    }

    const patient = await User.findById(patientId)
      .select("name email phone mrn dob gender bloodGroup dependents address")
      .lean();

    if (!patient) {
      return req.http.notFound("Patient record not found");
    }

    // Role-based record level check
    if (req.user.role === "patient" && String(patient._id) !== String(req.user._id)) {
      return req.http.forbidden("You may only view your own patient timeline");
    }

    // Fetch all medical and billing records concurrently
    const [
      appointments,
      clinicalNotes,
      prescriptions,
      labOrders,
      invoices,
      documents,
    ] = await Promise.all([
      Appointment.find({ patientId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
        .sort({ appointmentDate: -1 })
        .lean(),
      // Only include clinical notes if authorized (receptionist blocked)
      ["doctor", "clinic_admin", "admin"].includes(req.user.role)
        ? ClinicalNote.find({ patientId, isAmendment: false })
            .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
            .populate("diagnoses")
            .sort({ createdAt: -1 })
            .lean()
        : Promise.resolve([]),
      Prescription.find({ patientId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
        .sort({ createdAt: -1 })
        .lean(),
      LabOrder.find({ patientId })
        .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
        .populate("labResultId")
        .sort({ orderedAt: -1 })
        .lean(),
      Invoice.find({ patientId })
        .sort({ issuedAt: -1 })
        .lean(),
      HealthRecord.find({ patientId })
        .sort({ date: -1 })
        .lean(),
    ]);

    const events = [];

    // 1. Appointments
    appointments.forEach((apt) => {
      const docName = apt.doctorId?.userId?.name || apt.doctorId?.name || "Doctor";
      events.push({
        id: apt._id,
        type: "appointment",
        category: "Scheduling",
        timestamp: new Date(apt.appointmentDate || apt.createdAt),
        title: `Appointment with Dr. ${docName}`,
        subtitle: `${apt.type === "video" ? "Telemedicine Video Call" : "In-Person Clinic Visit"} • Slot: ${apt.timeSlot || "Standard"}`,
        status: apt.status,
        badgeColor: apt.status === "completed" ? "green" : apt.status === "cancelled" ? "red" : "blue",
        data: apt,
      });
    });

    // 2. Clinical Notes (EMR)
    clinicalNotes.forEach((note) => {
      const docName = note.doctorId?.userId?.name || "Physician";
      events.push({
        id: note._id,
        type: "clinical_note",
        category: "Clinical Evaluation",
        timestamp: new Date(note.signedAt || note.createdAt),
        title: `Clinical Consultation Note (v${note.version || 1})`,
        subtitle: `Dr. ${docName} • Chief Complaint: ${note.chiefComplaint || "General examination"}`,
        status: note.status,
        badgeColor: "indigo",
        data: note,
      });
    });

    // 3. Prescriptions
    prescriptions.forEach((rx) => {
      const docName = rx.doctorId?.userId?.name || "Physician";
      const medCount = rx.medicines?.length || 0;
      events.push({
        id: rx._id,
        type: "prescription",
        category: "Pharmacy",
        timestamp: new Date(rx.signedAt || rx.createdAt),
        title: `Electronic Prescription (${medCount} medication${medCount === 1 ? "" : "s"})`,
        subtitle: `Prescribed by Dr. ${docName}`,
        status: rx.status,
        badgeColor: "teal",
        data: rx,
      });
    });

    // 4. Lab Orders
    labOrders.forEach((lab) => {
      const isReleased = lab.status === "released";
      const testNames = lab.tests?.map((t) => t.name).join(", ") || "Diagnostic Panel";
      events.push({
        id: lab._id,
        type: "lab_order",
        category: "Pathology",
        timestamp: new Date(lab.releasedAt || lab.orderedAt || lab.createdAt),
        title: `Lab Investigation: ${lab.orderNumber}`,
        subtitle: `${testNames} • Priority: ${lab.priority?.toUpperCase()}`,
        status: lab.status,
        badgeColor: isReleased ? "emerald" : "purple",
        data: lab,
      });
    });

    // 5. Invoices & Billing
    invoices.forEach((inv) => {
      events.push({
        id: inv._id,
        type: "invoice",
        category: "Accounts",
        timestamp: new Date(inv.issuedAt || inv.createdAt),
        title: `Invoice ${inv.invoiceNumber} (₹${inv.totalAmount})`,
        subtitle: `Total: ₹${inv.totalAmount} • Balance: ₹${inv.balanceAmount} • Status: ${inv.status?.toUpperCase()}`,
        status: inv.status,
        badgeColor: inv.status === "paid" ? "green" : inv.status === "void" ? "gray" : "amber",
        data: inv,
      });
    });

    // 6. Documents & Health Records
    documents.forEach((doc) => {
      events.push({
        id: doc._id,
        type: "document",
        category: "Records",
        timestamp: new Date(doc.date || doc.createdAt),
        title: `Document Upload: ${doc.title}`,
        subtitle: `Format: ${doc.fileType?.toUpperCase()} • ${doc.notes || "Medical Record Attachment"}`,
        status: "available",
        badgeColor: "sky",
        data: doc,
      });
    });

    // Chronological Sort: newest first
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Optional Filter by event type
    const { type } = req.query;
    const filteredEvents = type && type !== "all"
      ? events.filter((e) => e.type === type)
      : events;

    // Audit log read of timeline
    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "read",
      resource: "patient_profile",
      resourceId: patient._id,
      req,
    });

    return req.http.ok({
      patient,
      events: filteredEvents,
      totalEvents: events.length,
      counts: {
        appointments: appointments.length,
        clinicalNotes: clinicalNotes.length,
        prescriptions: prescriptions.length,
        labOrders: labOrders.length,
        invoices: invoices.length,
        documents: documents.length,
      },
    });
  } catch (err) {
    next(err);
  }
};
