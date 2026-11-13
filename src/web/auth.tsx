import { createContext, useContext, type ReactNode } from 'react';
import type { AuthMe } from '../shared/types';
import type { AuthUser } from '../server/auth';

export type SessionUser = AuthMe['user'];

interface AuthCtx {
  user: SessionUser;
  setUser: (u: SessionUser) => void;
}

// Nilai lalai hanya supaya TypeScript senang - App sentiasa membekalkan nilai sebenar
const Ctx = createContext<AuthCtx>({ user: null, setUser: () => {} });

export function AuthProvider({ user, setUser, children }: AuthCtx & { children: ReactNode }) {
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}

export function isAdmin(u: SessionUser): boolean {
  return u?.role === 'admin';
}

export type { AuthUser };
