import { Router } from "express";
import * as integration from "../controllers/integrationController.js";
import * as attempt from "../controllers/attemptController.js";
import * as submission from "../controllers/submissionController.js";
import { requireLabSession } from "../middleware/requireLabSession.js";
import { redisRateLimit } from "../middleware/redisRateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  exchangeLaunchSchema,
  submissionSchema,
  taskIdParamsSchema,
  submissionIdParamsSchema,
  hintBodySchema
} from "../validation/schemas.js";

import {
  adminRouter,
} from "../routes/admin/admin.routes.js";

export const apiRouter = Router();

const launchLimit = redisRateLimit({ namespace: "launch", limit: 60, windowSeconds: 60 });
const exchangeLimit = redisRateLimit({ namespace: "exchange", limit: 30, windowSeconds: 60 });
const submissionLimit = redisRateLimit({
  namespace: "submission", limit: 120, windowSeconds: 60,
  key: (req) => req.labSession?.sub || req.ip
});

apiRouter.use("/admin",adminRouter);

apiRouter.post("/integrations/launch", launchLimit, integration.launch);
apiRouter.post("/auth/exchange", exchangeLimit, validate({ body: exchangeLaunchSchema }), integration.exchange);

apiRouter.get("/attempts/current", requireLabSession, attempt.current);
apiRouter.post(
  "/attempts/current/tasks/:taskId/hint",
  requireLabSession,
  validate({ params: taskIdParamsSchema, body: hintBodySchema }),
  attempt.hint
);
apiRouter.post("/attempts/current/terminal-ticket", requireLabSession, attempt.terminalTicket);
apiRouter.post("/attempts/current/finish", requireLabSession, attempt.finish);

apiRouter.post(
  "/submissions",
  requireLabSession,
  submissionLimit,
  validate({ body: submissionSchema }),
  submission.submit
);
apiRouter.get(
  "/submissions/:submissionId",
  requireLabSession,
  validate({ params: submissionIdParamsSchema }),
  submission.submissionStatus
);
