"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import LoginView from "@/components/LoginView";

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginView />
    </AuthProvider>
  );
}
