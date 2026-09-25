import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { allowedOrigins, env } from "./config/env.js";
import { requestId } from "./middleware/requestId.js";
import { httpLogger } from "./middleware/httpLogger.js";
import { metricsMiddleware, registry } from "./observability/metrics.js";
import { requireMetricsToken } from "./middleware/metricsAuth.js";
import { requireAllowedOrigin } from "./middleware/sameOrigin.js";
import { apiRouter } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { liveness, readiness } from "./health/healthService.js";
import { openapi } from "./docs/openapi.js";

export const app = express();

app.disable("x-powered-by");
if (env.TRUST_PROXY_HOPS > 0) app.set("trust proxy", env.TRUST_PROXY_HOPS);

app.use(requestId);
app.use(httpLogger);
app.use(metricsMiddleware);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" }
}));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(Object.assign(new Error("CORS origin not allowed"), { statusCode: 403 }));
  },
  credentials: true,
  methods: ["GET", "POST", "OPTIONS","PUT","DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"]
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "64kb" }));
app.use(requireAllowedOrigin);

app.get("/health/live", (_req, res) => res.status(200).json(liveness()));
app.get("/health/ready", async (_req, res) => {
  const state = await readiness();
  res.status(state.ok ? 200 : 503).json(state);
});
app.get("/metrics", requireMetricsToken, async (_req, res) => {
  res.type(registry.contentType).send(await registry.metrics());
});

if (env.NODE_ENV !== "production") {
  app.get("/openapi.json", (_req, res) => res.json(openapi));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: false }));
}

app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);
