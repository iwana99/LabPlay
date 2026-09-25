import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  customProps: (req) => ({
    requestId: req.id,
    attemptId: req.labSession?.attemptId,
    partnerId: req.labSession?.partnerId
  }),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  }
});
