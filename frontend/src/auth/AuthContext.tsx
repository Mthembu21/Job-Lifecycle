import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { apiClient, getStoredToken, setStoredToken } from "../api/client";
import { Role } from "../types";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get<AuthUser>("/auth/me")
      .then(({ data }) => setUser(data))
      .catch(() => setStoredToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { data } = await apiClient.post<{ token: string; user: AuthUser }>("/auth/login", {
      email,
      password,
    });
    setStoredToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setStoredToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
