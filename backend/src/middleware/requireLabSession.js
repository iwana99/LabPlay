import { verifyLabSession } from "../security/sessionToken.js";

export async function requireLabSession(req, res, next) {
  try {
    const token = req.cookies?.lab_session;
    if (!token) return res.status(401).json({ message: "Lab session is required" });
    req.labSession = await verifyLabSession(token);
    next();
  } catch {
    res.status(401).json({ message: "Lab session is invalid or expired" });
  }
}
