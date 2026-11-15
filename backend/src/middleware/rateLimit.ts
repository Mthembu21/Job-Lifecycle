import rateLimit from "express-rate-limit";

const MINUTE = 60_000;

/** Failed sign-ins per IP + email: 10 per 15 minutes. Successful sign-ins don't count. */
export const loginLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${String(req.body?.email ?? "").toLowerCase()}`,
  message: { error: "Too many failed sign-in attempts. Try again in 15 minutes." },
});

/** Failed sign-ins per IP regardless of email, so guessing across many accounts is slowed too. */
export const loginIpLimiter = rateLimit({
  windowMs: 15 * MINUTE,
  limit: 30,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many failed sign-in attempts. Try again in 15 minutes." },
});

/** General ceiling for the whole API per IP — generous for normal use, stops scraping and floods. */
export const apiLimiter = rateLimit({
  windowMs: MINUTE,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Slow down and try again shortly." },
});
