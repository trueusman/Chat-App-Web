import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api } from "./api";
import { disconnectSocket } from "./socket";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("cc_token");
    if (stored) {
      setToken(stored);
      api
        .get<{ user: User }>("/auth/me")
        .then(({ user }) => setUser(user))
        .catch(() => {
          localStorage.removeItem("cc_token");
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  function login(t: string, u: User) {
    localStorage.setItem("cc_token", t);
    setToken(t);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem("cc_token");
    disconnectSocket();
    setToken(null);
    setUser(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
