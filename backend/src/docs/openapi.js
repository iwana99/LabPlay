export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "SkillLab API",
    version: "1.0.0",
    description: "Partner launch, learner session and grading API. Student runner execution is handled by a separate isolated runner service."
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/integrations/launch": {
      post: {
        summary: "Validate a partner launch token and create an attempt",
        security: [{ partnerLaunchJwt: [] }],
        responses: {
          201: { description: "Attempt created and one-time launch URL returned" },
          401: { description: "Invalid launch token" },
          404: { description: "Lab not found" }
        }
      }
    },
    "/auth/exchange": {
      post: {
        summary: "Exchange one-time browser code for an HttpOnly lab session cookie",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LaunchExchange" } } }
        },
        responses: { 204: { description: "Session established" }, 401: { description: "Expired or reused launch code" } }
      }
    },
    "/attempts/current": {
      get: {
        summary: "Get the learner's current lab attempt",
        security: [{ labSessionCookie: [] }],
        responses: { 200: { description: "Current attempt" }, 401: { description: "No valid lab session" } }
      }
    },
    "/submissions": {
      post: {
        summary: "Queue a task for grading",
        security: [{ labSessionCookie: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckSubmission" } } }
        },
        responses: { 202: { description: "Submission accepted for grading" }, 400: { description: "Validation error" } }
      }
    }
  },
  components: {
    securitySchemes: {
      partnerLaunchJwt: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      labSessionCookie: { type: "apiKey", in: "cookie", name: "lab_session" }
    },
    schemas: {
      LaunchExchange: {
        type: "object",
        required: ["code"],
        additionalProperties: false,
        properties: { code: { type: "string", minLength: 20, maxLength: 300 } }
      },
      CheckSubmission: {
        type: "object",
        required: ["taskId"],
        additionalProperties: false,
        properties: {
          taskId: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
          source: { type: "string", maxLength: 200000 },
          language: { type: "string", enum: ["javascript", "typescript", "python", "java", "linux"] }
        }
      }
    }
  }
};
