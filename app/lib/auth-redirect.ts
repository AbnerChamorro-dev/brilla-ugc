const pendingAuthRedirectKey = "brilla-pending-auth-redirect-v1";
const pendingAuthRedirectLifetimeMs = 2 * 60 * 60 * 1000;

type PendingAuthRedirect = {
  path: string;
  initiatedAt: string;
};

function safeInternalPath(candidate: string | null, fallback: string) {
  if (typeof window === "undefined" || !candidate) return fallback;
  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

export function rememberAuthRedirect(path: string) {
  const pending: PendingAuthRedirect = {
    path: safeInternalPath(path, "/cuenta"),
    initiatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(pendingAuthRedirectKey, JSON.stringify(pending));
}

export function consumeAuthRedirect(fallback = "/cuenta") {
  if (typeof window === "undefined") return fallback;
  const stored = window.localStorage.getItem(pendingAuthRedirectKey);
  window.localStorage.removeItem(pendingAuthRedirectKey);
  if (!stored) return fallback;

  try {
    const pending = JSON.parse(stored) as Partial<PendingAuthRedirect>;
    const initiatedAt = typeof pending.initiatedAt === "string" ? new Date(pending.initiatedAt).getTime() : Number.NaN;
    if (!Number.isFinite(initiatedAt) || Date.now() - initiatedAt > pendingAuthRedirectLifetimeMs) return fallback;
    return safeInternalPath(typeof pending.path === "string" ? pending.path : null, fallback);
  } catch {
    return fallback;
  }
}
