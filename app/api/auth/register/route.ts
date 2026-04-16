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

  try {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
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
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    await prisma.log.create({
      data: {
        action: "auth.register",
        details: JSON.stringify({ userId: user.id }),
        userId: user.id,
      },
    });

    const accessToken = await signAccessToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const res = NextResponse.json({ user }, { status: 201 });

    res.cookies.set(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
    res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

    return res;
  } catch (err: unknown) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Username or email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
