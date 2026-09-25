import { createSubmission, getSubmissionForAttempt } from "../services/submissionService.js";

export async function submit(req, res) {
  const submission = await createSubmission({
    attemptId: req.labSession.sub,
    taskId: req.body?.taskId,
    mode: req.body?.mode,
    files: req.body?.files || []
  });
  res.status(202).json({ id: submission.id, status: submission.status });
}

export async function submissionStatus(req, res) {
  res.json(await getSubmissionForAttempt({
    attemptId: req.labSession.sub,
    submissionId: req.params.submissionId
  }));
}
