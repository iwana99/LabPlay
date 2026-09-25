import AdminUser
  from "../models/AdminUser.js";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "../security/adminSession.js";

export async function requireAdmin(
  req,
  res,
  next
) {
  try {
    const token =
      req.cookies?.[ADMIN_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({
        message:
          "Admin authentication required",
      });
    }

    const payload =
      await verifyAdminSession(token);

    const admin =
      await AdminUser.findOne({
        _id: payload.sub,
        isActive: true,
      });

    if (!admin) {
      return res.status(401).json({
        message:
          "Admin session is invalid",
      });
    }

    req.admin = {
      id: admin.id,
      role: admin.role,
      email: admin.email,
      name: admin.name,
    };

    next();
  } catch {
    return res.status(401).json({
      message:
        "Admin session is invalid or expired",
    });
  }
}