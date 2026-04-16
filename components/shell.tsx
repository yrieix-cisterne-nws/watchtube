"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  videoId: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseNotificationsPayload(v: unknown): {
  unreadCount: number;
  notifications: NotificationItem[];
} | null {
  if (!isRecord(v)) return null;
  if (typeof v.unreadCount !== "number") return null;
  if (!Array.isArray(v.notifications)) return null;

  const items: NotificationItem[] = [];
  for (const item of v.notifications) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string") continue;
    if (typeof item.type !== "string") continue;
    if (typeof item.message !== "string") continue;
    if (typeof item.isRead !== "boolean") continue;
    if (typeof item.createdAt !== "string") continue;

    const videoId = typeof item.videoId === "string" ? item.videoId : null;
    items.push({
      id: item.id,
      type: item.type,
      message: item.message,
      isRead: item.isRead,
      createdAt: item.createdAt,
      videoId,
    });
  }

  return { unreadCount: v.unreadCount, notifications: items };
}

function formatNotificationDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-surface"
    >
      <span className="text-muted">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function Icon({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center">
      {children}
    </span>
  );
}

function MenuIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </Icon>
  );
}

function MoonIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          d="M21 12.8A8.5 8.5 0 0 1 11.2 3 7 7 0 1 0 21 12.8Z"
        />
      </svg>
    </Icon>
  );
}

function BellIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"
        />
        <path strokeLinecap="round" d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    </Icon>
  );
}

function VideoIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          d="M15 10.5V6a2 2 0 0 0-2-2H6A2 2 0 0 0 4 6v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-4.5l5 4v-11l-5 4Z"
        />
      </svg>
    </Icon>
  );
}

function CompassIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path strokeLinecap="round" d="m14.5 9.5-6 2 2 6 6-2-2-6Z" />
      </svg>
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
        <path strokeLinecap="round" d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    </Icon>
  );
}

function HeartIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path
          strokeLinecap="round"
          d="M12 21s-7-4.35-9.33-8.66C.9 9.07 2.96 5.5 6.83 5.5c1.98 0 3.38 1.04 4.17 2.08.79-1.04 2.19-2.08 4.17-2.08 3.87 0 5.93 3.57 4.16 6.84C19 16.65 12 21 12 21Z"
        />
      </svg>
    </Icon>
  );
}

function UserIcon() {
  return (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" d="M20 21a8 8 0 0 0-16 0" />
        <path strokeLinecap="round" d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    </Icon>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [me, setMe] = useState<null | { id: string; username: string }>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const closeNotificationsTimeoutRef = useRef<number | null>(null);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const closeUserMenuTimeoutRef = useRef<number | null>(null);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const ac = new AbortController();

    function parseMeResponse(v: unknown): { id: string; username: string } | null {
      if (!isRecord(v)) return null;
      const user = v.user;
      if (!isRecord(user)) return null;
      if (typeof user.id !== "string") return null;
      if (typeof user.username !== "string") return null;
      return { id: user.id, username: user.username };
    }

    (async () => {
      try {
        const res = await fetch("/api/me", {
          method: "GET",
          credentials: "include",
          signal: ac.signal,
        });

        if (!res.ok) {
          setMe(null);
          return;
        }

        const json: unknown = await res.json();
        setMe(parseMeResponse(json));
      } catch {
        setMe(null);
      }
    })();

    return () => {
      ac.abort();
    };
  }, [pathname]);

  function getUserInitials(username: string): ReactNode {
    const cleaned = username.trim();
    if (!cleaned) return <UserIcon />;

    const parts = cleaned
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0] ?? "?"}${parts[1][0] ?? "?"}`.toUpperCase();
    }

    return cleaned.slice(0, 2).toUpperCase();
  }

  const isDark = (resolvedTheme ?? "dark") === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function openUserMenu() {
    if (closeUserMenuTimeoutRef.current !== null) {
      window.clearTimeout(closeUserMenuTimeoutRef.current);
      closeUserMenuTimeoutRef.current = null;
    }
    setUserMenuOpen(true);
  }

  function scheduleCloseUserMenu() {
    if (closeUserMenuTimeoutRef.current !== null) {
      window.clearTimeout(closeUserMenuTimeoutRef.current);
    }
    closeUserMenuTimeoutRef.current = window.setTimeout(() => {
      setUserMenuOpen(false);
      closeUserMenuTimeoutRef.current = null;
    }, 150);
  }

  const fetchNotifications = useCallback(
    async (take = 8) => {
      if (!me) return;

      try {
        const res = await fetch(`/api/notifications?take=${take}`, {
          method: "GET",
          credentials: "include",
        });

        if (res.status === 401) {
          setUnreadCount(0);
          setNotifications([]);
          return;
        }

        const json: unknown = await res.json().catch(() => null);
        const payload = parseNotificationsPayload(json);
        if (!payload) return;

        setUnreadCount(payload.unreadCount);
        setNotifications(payload.notifications);
      } catch {
        // ignore
      }
    },
    [me],
  );

  function openNotifications() {
    if (closeNotificationsTimeoutRef.current !== null) {
      window.clearTimeout(closeNotificationsTimeoutRef.current);
      closeNotificationsTimeoutRef.current = null;
    }

    setNotificationsOpen(true);
    void fetchNotifications();
  }

  function scheduleCloseNotifications() {
    if (closeNotificationsTimeoutRef.current !== null) {
      window.clearTimeout(closeNotificationsTimeoutRef.current);
    }
    closeNotificationsTimeoutRef.current = window.setTimeout(() => {
      setNotificationsOpen(false);
      closeNotificationsTimeoutRef.current = null;
    }, 150);
  }

  async function openNotification(n: NotificationItem) {
    setNotificationsOpen(false);

    if (!n.isRead) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, {
          method: "POST",
          credentials: "include",
        });

        setNotifications((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }

    if (n.videoId) {
      router.push(`/watch/${n.videoId}`);
      return;
    }

    router.push("/notifications");
  }

  useEffect(() => {
    if (!me) {
      setUnreadCount(0);
      setNotifications([]);
      setNotificationsOpen(false);
      return;
    }

    void fetchNotifications();
  }, [me, pathname, fetchNotifications]);

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setMe(null);
      setUserMenuOpen(false);
      router.refresh();
    }
  }

  useEffect(() => {
    return () => {
      if (closeUserMenuTimeoutRef.current !== null) {
        window.clearTimeout(closeUserMenuTimeoutRef.current);
      }
      if (closeNotificationsTimeoutRef.current !== null) {
        window.clearTimeout(closeNotificationsTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col bg-background font-sans text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-foreground ring-1 ring-border hover:bg-surface/80"
            aria-label={sidebarOpen ? "Fermer la sidebar" : "Ouvrir la sidebar"}
          >
            <MenuIcon />
          </button>

          <Link href="/feed" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">WatchTube</span>
          </Link>

          <form action="/search" method="GET" className="ml-2 flex flex-1">
            <div className="relative w-full">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <Icon>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" d="M21 21l-4.3-4.3" />
                    <path
                      strokeLinecap="round"
                      d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"
                    />
                  </svg>
                </Icon>
              </div>
              <input
                name="q"
                placeholder="Explorer les contenus..."
                className="h-10 w-full rounded-2xl bg-surface pl-10 pr-3 text-sm text-foreground placeholder:text-muted ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-border/60"
              />
            </div>
          </form>

          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-foreground ring-1 ring-border hover:bg-surface/80"
            aria-label="Changer le thème"
          >
            <MoonIcon />
          </button>

          <Link
            href={me ? "/upload" : "/auth"}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-surface px-4 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80"
          >
            <VideoIcon />
            Créer
          </Link>

          <div
            className="relative"
            onMouseLeave={scheduleCloseNotifications}
            onBlurCapture={scheduleCloseNotifications}
          >
            <button
              type="button"
              onClick={() => {
                if (!me) {
                  router.push(`/auth?next=${encodeURIComponent(pathname)}`);
                  return;
                }

                if (notificationsOpen) {
                  setNotificationsOpen(false);
                  return;
                }

                openNotifications();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-foreground ring-1 ring-border hover:bg-surface/80"
              aria-label="Notifications"
            >
              <span className="relative">
                <BellIcon />
                {me && unreadCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
            </button>

            {me && notificationsOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-2 w-80 rounded-2xl bg-background/95 p-2 ring-1 ring-border backdrop-blur"
                onMouseEnter={openNotifications}
                onMouseLeave={scheduleCloseNotifications}
              >
                <div className="flex items-center justify-between px-2 py-1">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Notifications
                  </div>
                  <Link
                    href="/notifications"
                    className="text-xs font-semibold text-muted hover:text-foreground"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    Tout voir
                  </Link>
                </div>

                {notifications.length === 0 ? (
                  <div className="mt-2 rounded-xl bg-surface p-3 text-sm text-muted ring-1 ring-border">
                    Aucune notification.
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => void openNotification(n)}
                        className={
                          n.isRead
                            ? "w-full rounded-xl bg-surface p-3 text-left text-sm text-foreground ring-1 ring-border hover:bg-surface/80"
                            : "w-full rounded-xl bg-surface p-3 text-left text-sm text-foreground ring-2 ring-border hover:bg-surface/80"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground">{n.message}</div>
                            <div className="mt-1 text-xs text-muted">
                              {formatNotificationDate(n.createdAt)}
                            </div>
                          </div>
                          {!n.isRead ? (
                            <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-foreground" />
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div
            className="relative"
            onMouseEnter={() => {
              if (me) openUserMenu();
            }}
            onMouseLeave={() => {
              scheduleCloseUserMenu();
            }}
            onFocusCapture={() => {
              if (me) openUserMenu();
            }}
            onBlurCapture={() => {
              scheduleCloseUserMenu();
            }}
          >
            {me ? (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-fuchsia-500 to-violet-500 text-sm font-bold text-white"
                aria-label="Compte"
              >
                {getUserInitials(me.username)}
              </button>
            ) : (
              <Link
                href="/auth"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-fuchsia-500 to-violet-500 text-sm font-bold text-white"
                aria-label="Connexion / Inscription"
              >
                <UserIcon />
              </Link>
            )}

            {me && userMenuOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-2 w-44 rounded-2xl bg-background/95 p-2 ring-1 ring-border backdrop-blur"
                onMouseEnter={openUserMenu}
                onMouseLeave={scheduleCloseUserMenu}
              >
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center justify-center rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-surface/80"
                >
                  Se déconnecter
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {sidebarOpen ? (
          <aside className="w-72 shrink-0 border-r border-border bg-surface">
            <div className="sticky top-16 p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted">
                Navigation
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <NavItem href="/feed" label="Découvrir" icon={<CompassIcon />} />
                <NavItem
                  href="/feed?scope=subscriptions"
                  label="Abonnements"
                  icon={<UsersIcon />}
                />
              </div>

              <div className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted">
                Espace Personnel
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <NavItem href="/liked" label="Favoris" icon={<HeartIcon />} />
              </div>
            </div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
