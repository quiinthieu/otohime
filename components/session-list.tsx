// Sessions as people read them: "Safari on iOS · 203.0.113.4 · 3 hours ago".
// Server-rendered only (it reads the clock), so no hydration drift.

export type SessionRow = {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  updatedAt: Date;
};

// ponytail: a few regexes, not a UA parser; good enough to tell devices apart
function device(ua?: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "A browser";
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown OS";
  return `${browser} on ${os}`;
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function ago(date: Date) {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  for (const [unit, size] of [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ] as const) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function SessionList<T extends SessionRow>({
  sessions,
  action,
  empty,
}: {
  sessions: T[];
  action?: (session: T) => React.ReactNode;
  empty: string;
}) {
  if (!sessions.length) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {sessions.map((session) => (
        <li key={session.id} className="flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold">{device(session.userAgent)}</p>
            <p className="text-sm text-muted">
              {[session.ipAddress, `active ${ago(session.updatedAt)}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          {action?.(session)}
        </li>
      ))}
    </ul>
  );
}
