import { create } from 'zustand';

export interface OpsUserBrief {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

interface OpsAuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: OpsUserBrief | null;
  setSession: (a: string, r: string, u: OpsUserBrief) => void;
  setAccess: (a: string) => void;
  clear: () => void;
  isAdmin: () => boolean;
}

const LS_KEY = 'cs-ops-session';

const loadInitial = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { accessToken: null, refreshToken: null, user: null };
    const parsed = JSON.parse(raw);
    return {
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken || null,
      user: parsed.user || null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, user: null };
  }
};

const persist = (s: Partial<OpsAuthState>) => {
  localStorage.setItem(LS_KEY, JSON.stringify({
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    user: s.user,
  }));
};

export const useOpsAuth = create<OpsAuthState>((set, get) => ({
  ...loadInitial(),
  setSession: (a, r, u) => {
    set({ accessToken: a, refreshToken: r, user: u });
    persist({ accessToken: a, refreshToken: r, user: u });
  },
  setAccess: (a) => {
    set({ accessToken: a });
    const cur = get();
    persist({ accessToken: a, refreshToken: cur.refreshToken, user: cur.user });
  },
  clear: () => {
    set({ accessToken: null, refreshToken: null, user: null });
    localStorage.removeItem(LS_KEY);
  },
  isAdmin: () => get().user?.role === 'ops_admin',
}));
