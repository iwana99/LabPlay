import crypto from "node:crypto";

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,100}$/;

export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  req.id = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
}
