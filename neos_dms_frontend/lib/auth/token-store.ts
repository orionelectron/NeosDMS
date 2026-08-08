const REFRESH_TOKEN_KEY = "neos.refreshToken";

let accessToken: string | null = null;

type Listener = () => void;

const listeners = new Set<Listener>();

function emitClear() {
  for (const listener of listeners) listener();
}

export const tokenStore = {
  getAccessToken(): string | null {
    return accessToken;
  },

  getRefreshToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(access: string, refresh: string): void {
    accessToken = access;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
  },

  clear(): void {
    accessToken = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    emitClear();
  },

  onClear(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
