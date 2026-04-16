import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
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

export async function POST(req: Request) {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
  }

  const now = new Date();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const existing = await prisma.refreshToken.findFirst({
    where: {
      tokenHash: refreshTokenHash,
      revokedAt: null,
      expiresAt: {
        gt: now,
      },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          username: true,
          role: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: now },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
      },
    }),
    prisma.log.create({
      data: {
        action: "auth.refresh",
        details: JSON.stringify({ userId: existing.userId }),
        userId: existing.userId,
      },
    }),
  ]);

  const accessToken = await signAccessToken({
    userId: existing.user.id,
    username: existing.user.username,
    role: existing.user.role,
  });

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, getAccessCookieOptions());
  res.cookies.set(
    REFRESH_COOKIE_NAME,
    newRefreshToken,
    getRefreshCookieOptions(),
  );

  return res;
}
