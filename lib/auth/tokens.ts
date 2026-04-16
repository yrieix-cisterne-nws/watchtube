import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

export const ACCESS_COOKIE_NAME = "wt_access";
export const REFRESH_COOKIE_NAME = "wt_refresh";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ISSUER = "watchtube";
const AUDIENCE = "watchtube:web";

export type AccessTokenPayload = {
  sub: string;
  username: string;
  role: "USER" | "ADMIN";
};

export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  path: string;
  maxAge: number;
};

function isProd() {
  return process.env.NODE_ENV === "production";
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (!isProd()) {
      return new TextEncoder().encode("dev-secret-change-me");
    }

    throw new Error("JWT_SECRET is not set");
  }

  return new TextEncoder().encode(secret);
}

export function getAccessCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  };
}

export function getRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd(),
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  };
}

export async function signAccessToken(input: {
  userId: string;
  username: string;
  role: "USER" | "ADMIN";
}): Promise<string> {
  return await new SignJWT({ username: input.username, role: input.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  const sub = payload.sub;
  const username = payload.username;
  const role = payload.role;

  if (typeof sub !== "string") {
    throw new Error("Invalid access token: sub");
  }
  if (typeof username !== "string") {
    throw new Error("Invalid access token: username");
  }
  if (role !== "USER" && role !== "ADMIN") {
    throw new Error("Invalid access token: role");
  }

  return {
    sub,
    username,
    role,
  };
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(refreshToken: string): string {
  return createHash("sha256").update(refreshToken).digest("hex");
}
