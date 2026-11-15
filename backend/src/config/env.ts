import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === "production";

const jwtSecret = required("JWT_SECRET");
if (jwtSecret.length < 32) {
  const message = "JWT_SECRET must be at least 32 random characters (generate one with: npm run secret -w backend)";
  if (isProduction) throw new Error(message);
  console.warn(`[security] ${message}`);
}

export const env = {
  isProduction,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim()),
  /** Behind a reverse proxy / load balancer, set to the number of hops (usually 1) so rate limits see real client IPs. */
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  /** Secret that goes in the TV board link (?key=…). Without it the board is turned off. */
  boardAccessKey: process.env.BOARD_ACCESS_KEY ?? "",
};
