"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext(null);

const STORAGE_KEY = "task_maid_role";

export function AuthProvider({ children }) {
  const [role, setRole] = useState(null); // null | "gopal" | "admin"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === "gopal" || saved === "admin") {
        setRole(saved);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  function login(password) {
    const gopalPw = process.env.NEXT_PUBLIC_GOPAL_PASSWORD;
    const adminPw = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    if (password === adminPw) {
      setRole("admin");
      sessionStorage.setItem(STORAGE_KEY, "admin");
      return { success: true, role: "admin" };
    }
    if (password === gopalPw) {
      setRole("gopal");
      sessionStorage.setItem(STORAGE_KEY, "gopal");
      return { success: true, role: "gopal" };
    }
    return { success: false, role: null };
  }

  function logout() {
    setRole(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  return (
    <AuthContext.Provider value={{ role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
