import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { saveUser, loadUser, clearUser } from "@/lib/storage";

type Role = "student" | "lecturer";

export type User = {
  id: string;
  first_name: string;
  last_name: string;
  identifier: string;
  role: Role;
  department: string;
};

type LoginPayload = { identifier: string; password: string };

type RegisterPayload = {
  first_name: string;
  last_name: string;
  identifier: string;
  role: Role;
  department: string;
  password: string;
};

type AuthContextType = {
  user: User | null;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  isStudent: boolean;
  isLecturer: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = loadUser();
    if (u) setUser(u);
  }, []);

  async function login(payload: LoginPayload) {
    const res = await apiRequest<{ ok: boolean; user: User }>("/auth/login", {
      method: "POST",
      body: payload,
    });

    saveUser(res.user);
    setUser(res.user);
    return res.user;
  }

  async function register(payload: RegisterPayload) {
    // IMPORTANT: send EXACT keys backend expects: first_name, last_name, identifier, role, department, password
    const res = await apiRequest<{ ok: boolean; user: User }>("/auth/register", {
      method: "POST",
      body: payload,
    });

    saveUser(res.user);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearUser();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      isStudent: user?.role === "student",
      isLecturer: user?.role === "lecturer",
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
