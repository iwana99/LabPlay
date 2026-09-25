import { z } from "zod";

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

export const exchangeLaunchSchema = z.object({
  code: z.string().min(20).max(300)
}).strict();

export const submissionSchema = z.object({
  taskId: objectIdSchema,
  mode: z.enum(["run", "check"]),
  files: z.array(z.object({
    path: z.string().min(1).max(300).refine((v) => !v.includes("\0"), "Invalid path"),
    content: z.string().max(200_000)
  }).strict()).max(40).default([])
}).strict();

export const taskIdParamsSchema = z.object({ taskId: objectIdSchema }).strict();
export const submissionIdParamsSchema = z.object({ submissionId: objectIdSchema }).strict();
export const hintBodySchema = z.object({ level: z.coerce.number().int().min(1).max(3).default(1) }).strict();
