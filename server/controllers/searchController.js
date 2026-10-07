import User from "../models/User.js";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Invoice from "../models/Invoice.js";
import LabOrder from "../models/LabOrder.js";

export const globalSearch = async (req, res, next) => {
  try {
    const { q, limit = 8 } = req.query;

    if (!q || !q.trim()) {
      return req.http.ok({
        doctors: [],
        patients: [],
        appointments: [],
        invoices: [],
        labOrders: [],
      });
    }

    const term = q.trim();
    const regex = new RegExp(term, "i");
    const numLimit = Number(limit);

    // 1. Doctors Search (by doctor name, specialization, clinic name, city)
    const matchingDoctorUsers = await User.find({
      role: "doctor",
      $or: [{ name: regex }, { email: regex }, { phone: regex }],
    })
      .select("_id")
      .lean();
    const doctorUserIds = matchingDoctorUsers.map((u) => u._id);

    const doctorsPromise = Doctor.find({
      $or: [
        { userId: { $in: doctorUserIds } },
        { specialization: regex },
        { clinicName: regex },
        { city: regex },
      ],
    })
      .populate("userId", "name email phone image")
      .limit(numLimit)
      .lean();

    // 2. Patients Search
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
    if (req.user?.role === "patient") {
      patientQuery._id = req.user._id;
    }

    const patientsPromise = User.find(patientQuery)
      .select("name mrn phone email gender dob")
      .limit(numLimit)
      .lean();

    // 3. Appointments Search
    let aptQuery = {};
    if (req.user?.role === "patient") {
      aptQuery.patientId = req.user._id;
    } else if (req.user?.role === "doctor") {
      // Find doctor record
      const doc = await Doctor.findOne({ userId: req.user._id }).select("_id").lean();
      if (doc) aptQuery.doctorId = doc._id;
    }

    const aptOrConditions = [
      { status: regex },
      { reason: regex },
    ];
    if (!isNaN(Number(term))) {
      aptOrConditions.push({ tokenNumber: Number(term) });
    }

    const appointmentsPromise = Appointment.find({
      ...aptQuery,
      $or: aptOrConditions,
    })
      .populate("patientId", "name mrn phone")
      .populate({ path: "doctorId", populate: { path: "userId", select: "name specialization" } })
      .sort({ appointmentDate: -1 })
      .limit(numLimit)
      .lean();

    // 4. Invoices Search
    let invQuery = {};
    if (req.user?.role === "patient") {
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

    // 5. Lab Orders Search
    let labQuery = {};
    if (req.user?.role === "patient") {
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

    const [doctors, patients, appointments, invoices, labOrders] = await Promise.all([
      doctorsPromise,
      patientsPromise,
      appointmentsPromise,
      invoicesPromise,
      labOrdersPromise,
    ]);

    return req.http.ok({
      query: term,
      doctors: doctors.filter((d) => d.userId),
      patients,
      appointments,
      invoices,
      labOrders,
    });
  } catch (err) {
    next(err);
  }
};
