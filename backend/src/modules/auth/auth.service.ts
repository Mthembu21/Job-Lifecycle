import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export interface AuthUserLike {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  tokenVersion: number;
}

interface ResolveLoginUserInput {
  email: string;
  password: string;
  findUserByEmail: (email: string) => Promise<AuthUserLike | null>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
}

/** Minimum length for any password set in the app or by script. */
export const MIN_PASSWORD_LENGTH = 12;

// Compared against when the email doesn't exist, so a wrong email takes as long as a wrong
// password — response time can't be used to discover which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password-just-equalises-timing", 10);

function isDatabaseUnavailableError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /server selection timeout|topology|p1001|p2010|p2024|econnreset|etimedout|eai_again|internalerror/i.test(
      error.message
    )
  );
}

const RETRY_DELAYS_MS = [250, 750];

async function findUserWithRetry(
  email: string,
  findUserByEmail: ResolveLoginUserInput["findUserByEmail"]
): Promise<AuthUserLike | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await findUserByEmail(email);
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length || !isDatabaseUnavailableError(error)) {
        throw error;
      }
      console.warn(
        `[auth] database lookup failed (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}), retrying: ${
          (error as Error).message
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Returns the user if the email and password match, otherwise null. There is deliberately no
 * fallback: if the database can't be reached, login fails rather than letting anyone in.
 */
export async function resolveLoginUser({
  email,
  password,
  findUserByEmail,
  comparePassword,
}: ResolveLoginUserInput): Promise<AuthUserLike | null> {
  const user = await findUserWithRetry(email, findUserByEmail);
  if (!user) {
    await comparePassword(password, DUMMY_HASH);
    return null;
  }
  return (await comparePassword(password, user.passwordHash)) ? user : null;
}

/** Checks a new password against the policy; returns a message if it's not acceptable. */
export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (/^(password|epiroc|welcome|changeme)\d*!?$/i.test(password)) return "That password is too easy to guess";
  if (email && password.toLowerCase().includes(email.split("@")[0].toLowerCase())) {
    return "Don't include your username in the password";
  }
  return null;
}
