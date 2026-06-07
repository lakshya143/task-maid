"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import GopalView from "@/components/GopalView";

function GopalGuard() {
  const { role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!role) router.replace("/login");
    else if (role === "admin") router.replace("/admin");
  }, [role, loading, router]);

  if (loading || role !== "gopal") {
    return (
      <div className="min-h-screen bg-ios-lightgray flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-ios-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <GopalView />;
}

export default function GopalPage() {
  return (
    <AuthProvider>
      <GopalGuard />
    </AuthProvider>
  );
}
