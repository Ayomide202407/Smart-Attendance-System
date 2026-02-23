import { useState } from "react";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/endpoints";
import { saveUser, getUser, clearUser, type StoredUser } from "@/lib/storage";

type LoginResponse = { ok: boolean; user: StoredUser; message?: string };
type RegisterResponse = { ok: boolean; user: StoredUser; message?: string };

export function useAuth() {
  const [user, setUser] = useState<StoredUser | null>(getUser());

  async function login(identifier: string, password: string) {
    const res = await api<LoginResponse>(endpoints.auth.login, {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });

    saveUser(res.user);
    setUser(res.user);
    return res.user;
  }

  async function register(payload: any) {
    const res = await api<RegisterResponse>(endpoints.auth.register, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    saveUser(res.user);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearUser();
    setUser(null);
  }

  return {
    user,
    login,
    register,
    logout,
    isLecturer: user?.role === "lecturer",
    isStudent: user?.role === "student",
  };
}
