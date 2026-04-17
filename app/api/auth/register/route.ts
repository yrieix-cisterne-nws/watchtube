import { NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  hashRefreshToken,
  signAccessToken,
} from "@/lib/auth/tokens";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
});

const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_LIMIT = 15;

function getClientIp(req: Request): string {
  const h = req.headers;
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  // Dev / unknown proxy setup.
  return "unknown";
}

function getWindowStart(nowMs: number): Date {
  return new Date(Math.floor(nowMs / REGISTER_WINDOW_MS) * REGISTER_WINDOW_MS);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { username, email, password } = parsed.data;

  const ip = getClientIp(req);
  const nowMs = Date.now();
  const windowStart = getWindowStart(nowMs);

  try {
    const passwordHash = await hashPassword(password);

    const { user, accessToken, refreshToken } = await prisma.$transaction(async (tx) => {
      // Rate limit: at most REGISTER_LIMIT successful account creations per IP per 15-min window.
      // We reserve a slot inside the same transaction so failures don't consume quota.
      try {
        await tx.registerRateLimit.create({
          data: {
            ip,
            windowStart,
            count: 1,
          },
          select: { id: true },
        });
      } catch (err) {
        const e = err as { code?: string };
        // Existing row for this ip+windowStart (or a race where another request created it).
        if (e?.code !== "P2002") throw err;

        const updated = await tx.registerRateLimit.updateMany({
          where: {
            ip,
            windowStart,
            count: { lt: REGISTER_LIMIT },
          },
          data: {
            count: { increment: 1 },
          },
        });

        if (updated.count === 0) {
          throw new Error("RATE_LIMIT");
        }
      }

      const user = await tx.user.create({
        data: {
          username,
          email,
          password: passwordHash,
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const refreshToken = generateRefreshToken();
      const refreshTokenHash = hashRefreshToken(refreshToken);
      const refreshExpiresAt = new Date(nowMs + REFRESH_TOKEN_TTL_SECONDS * 1000);

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
        },
        select: { id: true },
      });

      await tx.log.create({
        data: {
          action: "auth.register",
          details: JSON.stringify({ userId: user.id, ip }),
          userId: user.id,
        },
      });

      const accessToken = await signAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role,
      });

      return { user, accessToken, refreshToken };
    });

    const res = NextResponse.json({ user }, { status: 201 });

    res.cookies.set(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
    res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "RATE_LIMIT") {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowStart.getTime() + REGISTER_WINDOW_MS - Date.now()) / 1000),
      );

      const res = NextResponse.json(
        {
          error: "Too many accounts created. Please try again later.",
          limit: REGISTER_LIMIT,
          windowSeconds: Math.floor(REGISTER_WINDOW_MS / 1000),
          retryAfterSeconds,
        },
        { status: 429 },
      );

      res.headers.set("Retry-After", String(retryAfterSeconds));
      return res;
    }

    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
