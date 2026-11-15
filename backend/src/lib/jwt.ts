import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export interface JwtPayload {
  sub: string;
  role: Role;
  name: string;
  email: string;
  /** The user's tokenVersion when the token was issued. */
  ver: number;
}

const ALGORITHM = "HS256";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: ALGORITHM,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export function verifyToken(token: string): JwtPayload {
  // Pin the algorithm so a token can't pick a weaker one.
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] }) as JwtPayload;
}
