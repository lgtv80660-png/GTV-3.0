type HlsSession = {
  id: string;
  targetUrl: string;
  baseUrl: string;
  createdAt: number;
};

const sessions = new Map<string, HlsSession>();

export function registerHlsSession(id: string, targetUrl: string): HlsSession {
  const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
  const session: HlsSession = {
    id,
    targetUrl,
    baseUrl,
    createdAt: Date.now(),
  };
  sessions.set(id, session);
  return session;
}

export function getHlsSession(id: string): HlsSession | undefined {
  return sessions.get(id);
}