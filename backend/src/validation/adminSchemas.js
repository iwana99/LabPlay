import { z } from "zod";

export const adminLoginSchema =
  z.object({
    email: z
      .string()
      .email()
      .max(200),

    password: z
      .string()
      .min(8)
      .max(200),
  })
  .strict();

export const createLabSchema =
  z.object({
    title: z
      .string()
      .min(3)
      .max(150),

    slug: z
      .string()
      .min(3)
      .max(120)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      ),

    track: z.enum([
      "linux",
      "frontend",
      "backend",
      "algorithms",
    ]),

    sandboxProfile: z
      .string()
      .min(2)
      .max(100),
  })
  .strict();

const starterFileSchema =
  z.object({
    path: z
      .string()
      .min(1)
      .max(300),

    content: z
      .string()
      .max(200_000),

    readOnly: z
      .boolean()
      .default(false),
  })
  .strict();

export const createTaskSchema =
  z.object({
    title: z
      .string()
      .min(2)
      .max(200),

    instructions: z
      .string()
      .min(3)
      .max(20_000),

    taskType: z.enum([
      "linux_state",
      "code",
      "frontend_project",
      "backend_project",
    ]),

    starterFiles: z
      .array(starterFileSchema)
      .max(40)
      .default([]),

    language: z
      .string()
      .max(50)
      .default("javascript"),

    hints: z
      .array(
        z.string().max(1000)
      )
      .max(10)
      .default([]),

    checker: z.any(),

    resourceLimits: z
      .object({
        cpuMillis: z
          .number()
          .int()
          .positive()
          .default(1000),

        memoryMb: z
          .number()
          .int()
          .positive()
          .default(256),

        timeoutMs: z
          .number()
          .int()
          .min(500)
          .max(15_000)
          .default(10_000),

        network: z
          .boolean()
          .default(false),
      })
      .default({
        cpuMillis: 1000,
        memoryMb: 256,
        timeoutMs: 10000,
        network: false,
      }),
  })
  .strict();