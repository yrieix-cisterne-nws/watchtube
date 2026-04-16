import { cookies } from "next/headers";

import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/auth/tokens";

export type SessionUser = {
  id: string;
  username: string;
  role: "USER" | "ADMIN";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token);
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
