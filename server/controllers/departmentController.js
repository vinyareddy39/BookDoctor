import Department from "../models/Department.js";
import { recordAudit } from "../middleware/auditLogger.js";

/**
 * GET /api/departments
 * List departments with search and pagination
 */
export const getDepartments = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const [departments, total] = await Promise.all([
      Department.find(filter)
        .populate("headDoctorId", "name specialization")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Department.countDocuments(filter),
    ]);

    return req.http.ok(
      {
        departments,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
      "Departments retrieved"
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/departments
 * Create new clinical department (Clinic Admin only)
 */
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, headDoctorId, isActive } = req.body;

    if (!name || !code) {
      return req.http.badRequest("Department name and code are required.");
    }

    const existing = await Department.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return req.http.badRequest(`Department with code '${code.toUpperCase().trim()}' already exists.`);
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description || "",
      headDoctorId: headDoctorId || undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "CREATE",
      resource: "Department",
      resourceId: String(department._id),
      details: `Created department '${department.name}' (${department.code})`,
      diff: { before: null, after: department.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.created({ department }, "Department created successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/departments/:id
 */
export const getDepartmentById = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id).populate("headDoctorId");
    if (!department) return req.http.notFound("Department not found");
    return req.http.ok({ department }, "Department details retrieved");
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/departments/:id
 * Update department details (Clinic Admin only)
 */
export const updateDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return req.http.notFound("Department not found");

    const before = department.toObject();

    if (req.body.name) department.name = req.body.name.trim();
    if (req.body.code) department.code = req.body.code.toUpperCase().trim();
    if (req.body.description !== undefined) department.description = req.body.description;
    if (req.body.headDoctorId !== undefined) department.headDoctorId = req.body.headDoctorId || undefined;
    if (req.body.isActive !== undefined) department.isActive = Boolean(req.body.isActive);

    await department.save();

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "UPDATE",
      resource: "Department",
      resourceId: String(department._id),
      details: `Updated department '${department.name}'`,
      diff: { before, after: department.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok({ department }, "Department updated successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/departments/:id
 * Soft or permanent delete (Clinic Admin only)
 */
export const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return req.http.notFound("Department not found");

    const before = department.toObject();
    await Department.findByIdAndDelete(req.params.id);

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "DELETE",
      resource: "Department",
      resourceId: req.params.id,
      details: `Deleted department '${department.name}' (${department.code})`,
      diff: { before, after: null },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok(null, "Department removed successfully");
  } catch (err) {
    next(err);
  }
};
