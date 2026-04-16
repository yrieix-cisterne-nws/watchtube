import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
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

const loginSchema = z.object({
  identifier: z.string().min(3).max(255),
  password: z.string().min(8).max(255),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { identifier, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { username: identifier }],
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      password: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword({ password, hash: user.password });
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    }),
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    }),
    prisma.log.create({
      data: {
        action: "auth.login",
        details: JSON.stringify({ userId: user.id }),
        userId: user.id,
      },
    }),
  ]);

  const accessToken = await signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  const res = NextResponse.json(
    {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
    { status: 200 },
  );

  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res;
}
