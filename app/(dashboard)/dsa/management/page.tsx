"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DsaManagementPage } from "@/components/screens/dsa-pages";
import { useMockStore } from "@/lib/store";

function isSuperAdmin(role?: string | null) {
  if (!role) return false;
  const normalized = role.toLowerCase().replace(/[-_ ]/g, "");
  return normalized === "superadmin" || normalized === "admin";
}

export default function Page() {
  const router = useRouter();
  const { currentUser } = useMockStore();

  useEffect(() => {
    if (currentUser && !isSuperAdmin(currentUser.role)) {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  if (!currentUser || !isSuperAdmin(currentUser.role)) {
    return null;
  }

  return <DsaManagementPage />;
}
