"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      ログアウト
    </Button>
  );
}
