import User from "../models/User.js";
import HealthRecord from "../models/HealthRecord.js";

// GET ALL USERS (Admin only)
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    return req.http.ok(users);
  } catch (err) {
    next(err);
  }
};

// UPDATE MY PROFILE
// ⚠️  SECURITY: only whitelisted fields — never allow role/isVerified from client
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, dob, gender, bloodGroup, emergencyContact, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, phone, dob, gender, bloodGroup, emergencyContact, profilePicture },
      { new: true, runValidators: true }
    ).select("-password");

    return req.http.ok(user, "Profile updated");
  } catch (err) {
    next(err);
  }
};

// GET MY PROFILE
export const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return req.http.notFound("User not found");
    return req.http.ok(user, "User profile fetched");
  } catch (err) {
    next(err);
  }
};

// ─── DEPENDENTS ───────────────────────────────────────────────────────────

export const addDependent = async (req, res, next) => {
  try {
    const { name, relation, dob, gender } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return req.http.notFound("User not found");

    user.dependents.push({ name, relation, dob, gender });
    await user.save();
    return req.http.ok(user.dependents, "Dependent added successfully");
  } catch (err) {
    next(err);
  }
};

export const removeDependent = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return req.http.notFound("User not found");

    user.dependents = user.dependents.filter(dep => dep._id.toString() !== req.params.depId);
    await user.save();
    return req.http.ok(user.dependents, "Dependent removed");
  } catch (err) {
    next(err);
  }
};

// ─── HEALTH RECORDS ───────────────────────────────────────────────────────

export const uploadHealthRecord = async (req, res, next) => {
  try {
    if (!req.file) return req.http.badRequest("No file uploaded");
    
    const { title, dependentId, notes } = req.body;
    
    // Check file type
    const mimeType = req.file.mimetype;
    let fileType = "other";
    if (mimeType.startsWith("image/")) fileType = "image";
    if (mimeType === "application/pdf") fileType = "pdf";

    const record = await HealthRecord.create({
      patientId: req.user._id,
      dependentId: dependentId || null,
      title,
      notes,
      fileUrl: `/uploads/${req.file.filename}`,
      fileType,
    });

    return req.http.created(record, "Health record uploaded successfully");
  } catch (err) {
    next(err);
  }
};

export const getHealthRecords = async (req, res, next) => {
  try {
    const filter = { patientId: req.user._id };
    if (req.query.dependentId) {
      filter.dependentId = req.query.dependentId;
    }
    
    const records = await HealthRecord.find(filter).sort({ date: -1 });
    return req.http.ok(records, "Health records fetched");
  } catch (err) {
    next(err);
  }
};

export const deleteHealthRecord = async (req, res, next) => {
  try {
    const record = await HealthRecord.findOneAndDelete({
      _id: req.params.id,
      patientId: req.user._id
    });
    if (!record) return req.http.notFound("Record not found or unauthorized");
    return req.http.ok(null, "Record deleted");
  } catch (err) {
    next(err);
  }
};