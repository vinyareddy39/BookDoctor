import LabOrder from "../models/LabOrder.js";
import LabResult from "../models/LabResult.js";
import Doctor from "../models/Doctor.js";
import User from "../models/User.js";
import { recordAudit } from "../middleware/auditLogger.js";
import { sendNotificationToUser } from "../socket.js";

// Helper: resolve doctor id for current user
const resolveDoctorId = async (user) => {
  if (user.role === "doctor") {
    const doc = await Doctor.findOne({ userId: user._id });
    return doc?._id || null;
  }
  return null;
};

// ── CREATE LAB ORDER (Doctor, Clinic Admin) ──────────────────────────────────
export const createLabOrder = async (req, res, next) => {
  try {
    const { patientId, tests, priority, clinicalNotes, appointmentId, clinicalNoteId } = req.body;

    let doctorId = req.body.doctorId;
    if (req.user.role === "doctor") {
      doctorId = await resolveDoctorId(req.user);
      if (!doctorId) return req.http.badRequest("Doctor profile not found");
    }

    if (!patientId || !tests || !Array.isArray(tests) || tests.length === 0) {
      return req.http.badRequest("patientId and at least one lab test are required");
    }

    const orderNumber = await LabOrder.generateOrderNumber();

    const order = await LabOrder.create({
      orderNumber,
      patientId,
      doctorId,
      appointmentId: appointmentId || null,
      clinicalNoteId: clinicalNoteId || null,
      tests,
      priority: priority || "routine",
      clinicalNotes: clinicalNotes || "",
      status: "ordered",
      orderedAt: new Date(),
    });

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "lab_order",
      resourceId: order._id,
      after: order.toObject(),
      req,
    });

    const populated = await LabOrder.findById(order._id)
      .populate("patientId", "name mrn phone email dob gender")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name" } });

    return req.http.created(populated, `Lab order ${orderNumber} created successfully`);
  } catch (err) {
    next(err);
  }
};

// ── GET LAB ORDERS (Role-Scoped with Status Transitions) ─────────────────────
export const getLabOrders = async (req, res, next) => {
  try {
    const { status, priority, patientId, search } = req.query;
    let query = {};

    // Role-based visibility
    if (req.user.role === "patient") {
      query.patientId = req.user._id;
    } else if (patientId) {
      query.patientId = patientId;
    }

    if (req.user.role === "doctor" && !patientId) {
      const docId = await resolveDoctorId(req.user);
      if (docId) query.doctorId = docId;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const orders = await LabOrder.find(query)
      .populate("patientId", "name mrn phone email dob gender bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .populate("sampleCollectedBy", "name")
      .populate("resultEnteredBy", "name")
      .populate("verifiedBy", "name")
      .populate("releasedBy", "name")
      .populate("labResultId")
      .sort({ createdAt: -1 })
      .lean();

    // Patient visibility enforcement: hide results unless released
    if (req.user.role === "patient") {
      orders.forEach((o) => {
        if (o.status !== "released") {
          o.labResultId = null; // hide raw lab values until formally released
        }
      });
    }

    return req.http.ok(orders);
  } catch (err) {
    next(err);
  }
};

// ── GET LAB ORDER BY ID ──────────────────────────────────────────────────────
export const getLabOrderById = async (req, res, next) => {
  try {
    const order = await LabOrder.findById(req.params.id)
      .populate("patientId", "name mrn phone email dob gender bloodGroup")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization qualification clinicName" } })
      .populate("sampleCollectedBy", "name")
      .populate("resultEnteredBy", "name")
      .populate("verifiedBy", "name")
      .populate("releasedBy", "name")
      .populate("labResultId")
      .lean();

    if (!order) return req.http.notFound("Lab order not found");

    if (req.user.role === "patient") {
      if (String(order.patientId?._id || order.patientId) !== String(req.user._id)) {
        return req.http.forbidden("You can only access your own lab orders.");
      }
      if (order.status !== "released") {
        order.labResultId = null;
      }
    }

    return req.http.ok(order);
  } catch (err) {
    next(err);
  }
};

// ── COLLECT SAMPLE (Lab Tech, Clinic Admin) ──────────────────────────────────
export const collectSample = async (req, res, next) => {
  try {
    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (order.status !== "ordered") {
      return req.http.badRequest(`Cannot collect sample: order is currently ${order.status}`);
    }

    const before = order.toObject();
    order.status = "sample_collected";
    order.sampleCollectedAt = new Date();
    order.sampleCollectedBy = req.user._id;
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "lab_order",
      resourceId: order._id,
      before,
      after: order.toObject(),
      req,
    });

    return req.http.ok(order, "Specimen/Sample marked as collected");
  } catch (err) {
    next(err);
  }
};

// ── START PROCESSING (Lab Tech, Clinic Admin) ────────────────────────────────
export const startProcessing = async (req, res, next) => {
  try {
    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (order.status !== "sample_collected") {
      return req.http.badRequest(`Cannot begin processing: sample status is ${order.status}`);
    }

    const before = order.toObject();
    order.status = "processing";
    order.processingStartedAt = new Date();
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "lab_order",
      resourceId: order._id,
      before,
      after: order.toObject(),
      req,
    });

    return req.http.ok(order, "Laboratory analysis in progress");
  } catch (err) {
    next(err);
  }
};

// ── ENTER RESULTS (Lab Tech, Clinic Admin) ───────────────────────────────────
export const enterResults = async (req, res, next) => {
  try {
    const { parameters, interpretation, attachedFile } = req.body;

    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (!["processing", "sample_collected", "result_entered"].includes(order.status)) {
      return req.http.badRequest(`Cannot enter results: order status is currently ${order.status}`);
    }

    if (!parameters || !Array.isArray(parameters) || parameters.length === 0) {
      return req.http.badRequest("At least one test parameter result is required");
    }

    // Upsert LabResult record
    const resultData = {
      labOrderId: order._id,
      patientId: order.patientId,
      doctorId: order.doctorId,
      enteredBy: req.user._id,
      parameters,
      interpretation: interpretation || "",
      attachedFile: attachedFile || {},
      status: "draft",
    };

    let result = await LabResult.findOne({ labOrderId: order._id });
    if (result) {
      Object.assign(result, resultData);
      await result.save();
    } else {
      result = await LabResult.create(resultData);
    }

    const beforeOrder = order.toObject();
    order.status = "result_entered";
    order.resultEnteredAt = new Date();
    order.resultEnteredBy = req.user._id;
    order.labResultId = result._id;
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "create",
      resource: "lab_result",
      resourceId: result._id,
      after: result.toObject(),
      req,
    });

    return req.http.ok({ order, result }, "Test results recorded. Pending verification.");
  } catch (err) {
    next(err);
  }
};

// ── VERIFY RESULTS (Verifier != Entry User rule) ─────────────────────────────
export const verifyResults = async (req, res, next) => {
  try {
    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (order.status !== "result_entered") {
      return req.http.badRequest(`Cannot verify: results are in status ${order.status}`);
    }

    const result = await LabResult.findOne({ labOrderId: order._id });
    if (!result) return req.http.notFound("Associated lab results not found");

    // Strict clinical rule: Verifier must NOT be the same user who entered the result!
    // Exception: clinic_admin can bypass for solo-technician facilities.
    if (req.user.role !== "clinic_admin" && req.user.role !== "admin") {
      if (String(result.enteredBy) === String(req.user._id)) {
        return req.http.forbidden("Quality Assurance Violation: The verifier cannot be the same user who entered the test results.");
      }
    }

    const beforeResult = result.toObject();
    result.status = "verified";
    result.verifiedBy = req.user._id;
    await result.save();

    const beforeOrder = order.toObject();
    order.status = "verified";
    order.verifiedAt = new Date();
    order.verifiedBy = req.user._id;
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "lab_result",
      resourceId: result._id,
      before: beforeResult,
      after: result.toObject(),
      req,
    });

    // Notify the ordering doctor immediately
    const doctorDoc = await Doctor.findById(order.doctorId);
    if (doctorDoc?.userId) {
      sendNotificationToUser(doctorDoc.userId, {
        type: "LAB_RESULT_VERIFIED",
        title: "Lab Results Verified",
        message: `Lab results for Order ${order.orderNumber} have been clinically verified and are ready for release.`,
      });
    }

    return req.http.ok({ order, result }, "Results verified successfully. Ready to release.");
  } catch (err) {
    next(err);
  }
};

// ── RELEASE RESULTS (Lab Tech, Doctor, Clinic Admin) ─────────────────────────
export const releaseResults = async (req, res, next) => {
  try {
    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (order.status !== "verified") {
      return req.http.badRequest(`Cannot release: order must be verified first (currently ${order.status})`);
    }

    const result = await LabResult.findOne({ labOrderId: order._id });
    if (!result) return req.http.notFound("Associated lab results not found");

    result.status = "released";
    result.releasedBy = req.user._id;
    await result.save();

    order.status = "released";
    order.releasedAt = new Date();
    order.releasedBy = req.user._id;
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "update",
      resource: "lab_order",
      resourceId: order._id,
      after: order.toObject(),
      req,
    });

    // Notify the patient
    sendNotificationToUser(order.patientId, {
      type: "LAB_RESULT_RELEASED",
      title: "Lab Report Released",
      message: `Your laboratory report for Order ${order.orderNumber} is now available in your portal.`,
    });

    return req.http.ok({ order, result }, `Lab Order ${order.orderNumber} released to patient`);
  } catch (err) {
    next(err);
  }
};

// ── CANCEL LAB ORDER ─────────────────────────────────────────────────────────
export const cancelLabOrder = async (req, res, next) => {
  try {
    const { cancellationReason } = req.body;
    const order = await LabOrder.findById(req.params.id);
    if (!order) return req.http.notFound("Lab order not found");

    if (["verified", "released"].includes(order.status)) {
      return req.http.badRequest(`Cannot cancel an order that has already been ${order.status}`);
    }

    const before = order.toObject();
    order.status = "cancelled";
    order.cancellationReason = cancellationReason || "Order cancelled";
    await order.save();

    recordAudit({
      userId: req.user._id,
      role: req.user.role,
      action: "cancel",
      resource: "lab_order",
      resourceId: order._id,
      before,
      after: order.toObject(),
      req,
    });

    return req.http.ok(order, "Lab order cancelled");
  } catch (err) {
    next(err);
  }
};
