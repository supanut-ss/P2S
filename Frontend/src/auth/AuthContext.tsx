import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { AUTH_TOKEN_STORAGE_KEY } from '../api/client';
import { login as loginRequest } from '../api/authApi';
import type { LoginRequest } from '../types/auth';

interface AuthUser {
  username: string;
  fullName: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AUTH_USER_STORAGE_KEY = 'p2s.authUser';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      async login(request: LoginRequest) {
        const response = await loginRequest(request);
        localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, response.token);
        const nextUser: AuthUser = {
          username: response.username,
          fullName: response.fullName,
          role: response.role,
        };
        localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
      },
      logout() {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
