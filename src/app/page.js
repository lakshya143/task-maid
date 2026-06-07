"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

function RootRedirect() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (role === "admin") router.replace("/admin");
    else if (role === "gopal") router.replace("/gopal");
    else router.replace("/login");
  }, [role, loading, router]);

  return (
    <div className="min-h-screen bg-ios-lightgray flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <RootRedirect />
    </AuthProvider>
  );
}
