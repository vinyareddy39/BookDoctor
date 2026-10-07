import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Invoice from "../models/Invoice.js";
import LabOrder from "../models/LabOrder.js";

export const globalSearch = async (req, res, next) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || !q.trim()) {
      return req.http.ok({
        patients: [],
        appointments: [],
        invoices: [],
        labOrders: [],
      });
    }

    const term = q.trim();
    const regex = new RegExp(term, "i");
    const numLimit = Number(limit);

    // Patients Search
    const patientQuery = {
      role: "patient",
      $or: [
        { name: regex },
        { mrn: regex },
        { phone: regex },
        { email: regex },
      ],
    };

    // If patient is searching, restrict to themselves
    if (req.user.role === "patient") {
      patientQuery._id = req.user._id;
    }

    const patientsPromise = User.find(patientQuery)
      .select("name mrn phone email gender dob")
      .limit(numLimit)
      .lean();

    // Appointments Search
    let aptQuery = {};
    if (req.user.role === "patient") {
      aptQuery.patientId = req.user._id;
    }
    const appointmentsPromise = Appointment.find({
      ...aptQuery,
      $or: [
        { tokenNumber: regex },
        { status: regex },
        { reason: regex },
      ],
    })
      .populate("patientId", "name mrn phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .sort({ appointmentDate: -1 })
      .limit(numLimit)
      .lean();

    // Invoices Search
    let invQuery = {};
    if (req.user.role === "patient") {
      invQuery.patientId = req.user._id;
    }
    const invoicesPromise = Invoice.find({
      ...invQuery,
      $or: [
        { invoiceNumber: regex },
        { status: regex },
      ],
    })
      .populate("patientId", "name mrn phone")
      .sort({ issuedAt: -1 })
      .limit(numLimit)
      .lean();

    // Lab Orders Search
    let labQuery = {};
    if (req.user.role === "patient") {
      labQuery.patientId = req.user._id;
    }
    const labOrdersPromise = LabOrder.find({
      ...labQuery,
      $or: [
        { orderNumber: regex },
        { "tests.name": regex },
      ],
    })
      .populate("patientId", "name mrn phone")
      .sort({ orderedAt: -1 })
      .limit(numLimit)
      .lean();

    const [patients, appointments, invoices, labOrders] = await Promise.all([
      patientsPromise,
      appointmentsPromise,
      invoicesPromise,
      labOrdersPromise,
    ]);

    return req.http.ok({
      query: term,
      patients,
      appointments,
      invoices,
      labOrders,
    });
  } catch (err) {
    next(err);
  }
};
