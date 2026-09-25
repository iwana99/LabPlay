import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: "skilllab_" });

export const httpRequestDuration = new client.Histogram({
  name: "skilllab_http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry]
});

export const httpRequestsTotal = new client.Counter({
  name: "skilllab_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [registry]
});

export const gradingJobsTotal = new client.Counter({
  name: "skilllab_grading_jobs_total",
  help: "Grading jobs by result",
  labelNames: ["result"],
  registers: [registry]
});

export const activeLabSessions = new client.Gauge({
  name: "skilllab_active_lab_sessions",
  help: "Approximate number of active learner lab sessions",
  registers: [registry]
});

export const runnerProvisionDuration = new client.Histogram({
  name: "skilllab_runner_provision_duration_seconds",
  help: "Sandbox provisioning latency",
  labelNames: ["runtime", "result"],
  buckets: [0.25, 0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [registry]
});

export function metricsMiddleware(req, res, next) {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route = req.route?.path
      ? `${req.baseUrl || ""}${req.route.path}`
      : req.path === "/health/live" || req.path === "/health/ready" || req.path === "/metrics"
        ? req.path
        : "unmatched";
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}
