import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export interface AuthUserLike {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}

interface ResolveLoginUserInput {
  email: string;
  password: string;
  findUserByEmail: (email: string) => Promise<AuthUserLike | null>;
  comparePassword: (password: string, passwordHash: string) => Promise<boolean>;
  fallbackUser?: AuthUserLike | null;
}

const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Password123!";

const fallbackUsers: AuthUserLike[] = [
  {
    id: "demo-admin",
    name: "Alex Admin",
    email: "admin@demo.local",
    role: "ADMIN",
    passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  },
  {
    id: "demo-storeman",
    name: "Sipho Storeman",
    email: "storeman@demo.local",
    role: "STOREMAN",
    passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  },
  {
    id: "demo-planner",
    name: "Priya Planner",
    email: "planner@demo.local",
    role: "PLANNER",
    passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  },
  {
    id: "demo-supervisor",
    name: "Sam Supervisor",
    email: "supervisor@demo.local",
    role: "SUPERVISOR",
    passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  },
];

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

export async function resolveLoginUser({
  email,
  password,
  findUserByEmail,
  comparePassword,
  fallbackUser,
}: ResolveLoginUserInput): Promise<AuthUserLike | null> {
  try {
    const user = await findUserWithRetry(email, findUserByEmail);
    if (!user) return null;

    const valid = await comparePassword(password, user.passwordHash);
    return valid ? user : null;
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      const normalizedEmail = email.toLowerCase();
      const matchesFallback =
        fallbackUser?.email.toLowerCase() === normalizedEmail ||
        fallbackUsers.some((candidate) => candidate.email.toLowerCase() === normalizedEmail);

      if (matchesFallback && password === DEMO_PASSWORD) {
        console.warn(`[auth] database unavailable after retries, using fallback account for ${email}`);
        return fallbackUser ?? fallbackUsers.find((candidate) => candidate.email.toLowerCase() === normalizedEmail) ?? null;
      }

      console.error(`[auth] database unavailable after retries, no fallback match for ${email}`);
    }

    throw error;
  }
}

export function getFallbackUser(email: string): AuthUserLike | null {
  const normalizedEmail = email.toLowerCase();
  return fallbackUsers.find((candidate) => candidate.email.toLowerCase() === normalizedEmail) ?? null;
}
