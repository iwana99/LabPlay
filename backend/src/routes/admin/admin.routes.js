import {
  Router,
} from "express";

import {
  login,
  logout,
  me,
  listLabs,
  createLab,
  getLab,
  createTask,
  publishLab,
  updateTask,
  deleteTask,
} from "../../controllers/adminController.js";

import {
  requireAdmin,
} from "../../middleware/requireAdmin.js";

import {
  validate,
} from "../../middleware/validate.js";

import {
  redisRateLimit,
} from "../../middleware/redisRateLimit.js";

import {
  adminLoginSchema,
  createLabSchema,
  createTaskSchema,
} from "../../validation/adminSchemas.js";

import {
  createVersion,
} from "../../controllers/adminLabVersionController.js";
export const adminRouter =
  Router();


const loginLimit =
  redisRateLimit({
    namespace:
      "admin-login",

    limit: 10,

    windowSeconds:
      15 * 60,
  });


/* AUTH */

adminRouter.post(
  "/auth/login",
  loginLimit,
  validate({
    body:
      adminLoginSchema,
  }),
  login
);


adminRouter.get(
  "/auth/me",
  requireAdmin,
  me
);


adminRouter.post(
  "/auth/logout",
  requireAdmin,
  logout
);



/* LABS */

adminRouter.get(
  "/labs",
  requireAdmin,
  listLabs
);


adminRouter.post(
  "/labs",
  requireAdmin,
  validate({
    body:
      createLabSchema,
  }),
  createLab
);


adminRouter.get(
  "/labs/:labId",
  requireAdmin,
  getLab
);


adminRouter.post(
  "/labs/:labId/tasks",
  requireAdmin,
  validate({
    body:
      createTaskSchema,
  }),
  createTask
);


adminRouter.post(
  "/labs/:labId/publish",
  requireAdmin,
  publishLab
);

adminRouter.post(
  "/labs/:labId/versions",
  requireAdmin,
  createVersion
);

adminRouter.put(
  "/labs/:labId/tasks/:taskId",
  requireAdmin,
  validate({
    body:
      createTaskSchema,
  }),
  updateTask
);

adminRouter.delete(
  "/labs/:labId/tasks/:taskId",
  requireAdmin,
  deleteTask
);