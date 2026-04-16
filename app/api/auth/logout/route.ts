import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  getAccessCookieOptions,
  getRefreshCookieOptions,
  hashRefreshToken,
} from "@/lib/auth/tokens";

export async function POST() {
  const refreshToken = (await cookies()).get(REFRESH_COOKIE_NAME)?.value;
  const now = new Date();

  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);

    const existing = await prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (existing) {
      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { id: existing.id },
          data: { revokedAt: now },
        }),
        prisma.log.create({
          data: {
            action: "auth.logout",
            details: JSON.stringify({ userId: existing.userId }),
            userId: existing.userId,
          },
        }),
      ]);
    }
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });

  res.cookies.set(ACCESS_COOKIE_NAME, "", {
    ...getAccessCookieOptions(),
    maxAge: 0,
  });
  res.cookies.set(REFRESH_COOKIE_NAME, "", {
    ...getRefreshCookieOptions(),
    maxAge: 0,
  });

  return res;
}
