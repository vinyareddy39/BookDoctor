import Service from "../models/Service.js";
import { recordAudit } from "../middleware/auditLogger.js";

/**
 * GET /api/services
 * List clinical services with filtering by department, category, and search
 */
export const getServices = async (req, res, next) => {
  try {
    const { departmentId, category, search, isActive } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (departmentId) filter.departmentId = departmentId;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate("departmentId", "name code")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Service.countDocuments(filter),
    ]);

    return req.http.ok(
      {
        services,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
      "Services retrieved"
    );
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/services
 * Create clinical service (Clinic Admin only)
 */
export const createService = async (req, res, next) => {
  try {
    const { name, code, departmentId, price, durationMinutes, description, category, isActive } = req.body;

    if (!name || !code || !departmentId || price === undefined) {
      return req.http.badRequest("Name, code, department, and price are required.");
    }

    const existing = await Service.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return req.http.badRequest(`Service with code '${code.toUpperCase().trim()}' already exists.`);
    }

    const service = await Service.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      departmentId,
      price: Number(price),
      durationMinutes: Number(durationMinutes) || 15,
      description: description || "",
      category: category || "consultation",
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "CREATE",
      resource: "Service",
      resourceId: String(service._id),
      details: `Created service '${service.name}' (${service.code}) - ₹${service.price}`,
      diff: { before: null, after: service.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.created({ service }, "Service created successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/services/:id
 */
export const getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id).populate("departmentId");
    if (!service) return req.http.notFound("Service not found");
    return req.http.ok({ service }, "Service details retrieved");
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/services/:id
 * Update service details (Clinic Admin only)
 */
export const updateService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return req.http.notFound("Service not found");

    const before = service.toObject();

    if (req.body.name) service.name = req.body.name.trim();
    if (req.body.code) service.code = req.body.code.toUpperCase().trim();
    if (req.body.departmentId) service.departmentId = req.body.departmentId;
    if (req.body.price !== undefined) service.price = Number(req.body.price);
    if (req.body.durationMinutes !== undefined) service.durationMinutes = Number(req.body.durationMinutes);
    if (req.body.description !== undefined) service.description = req.body.description;
    if (req.body.category) service.category = req.body.category;
    if (req.body.isActive !== undefined) service.isActive = Boolean(req.body.isActive);

    await service.save();

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "UPDATE",
      resource: "Service",
      resourceId: String(service._id),
      details: `Updated service '${service.name}'`,
      diff: { before, after: service.toObject() },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok({ service }, "Service updated successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/services/:id
 */
export const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return req.http.notFound("Service not found");

    const before = service.toObject();
    await Service.findByIdAndDelete(req.params.id);

    recordAudit({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: "DELETE",
      resource: "Service",
      resourceId: req.params.id,
      details: `Deleted service '${service.name}'`,
      diff: { before, after: null },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return req.http.ok(null, "Service removed successfully");
  } catch (err) {
    next(err);
  }
};
