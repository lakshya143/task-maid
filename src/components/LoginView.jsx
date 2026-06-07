"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginView() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    const result = login(password.trim());

    if (result.success) {
      if (result.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/gopal");
      }
    } else {
      setError("Incorrect password. Try again.");
      setPassword("");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ios-lightgray flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      {/* App Icon */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-[22px] bg-ios-blue flex items-center justify-center shadow-lg">
          <span className="text-4xl">✓</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Task Maid
        </h1>
        <p className="text-sm text-ios-gray">Enter your password to continue</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4">
            <label className="block text-xs font-semibold text-ios-gray uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full text-lg text-gray-900 placeholder-gray-300 outline-none"
              autoFocus
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="px-5 pb-3">
              <p className="text-sm text-ios-red font-medium">{error}</p>
            </div>
          )}

          <div className="border-t border-gray-100">
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-4 text-ios-blue font-semibold text-base
                         disabled:opacity-40 active:bg-ios-lightgray transition-colors"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-8 text-xs text-ios-gray text-center">
        Gopal &amp; Admin have separate passwords
      </p>
    </div>
  );
}
