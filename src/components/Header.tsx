"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // ユーザー情報取得失敗時は何もしない
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "DELETE" });
    } catch {
      // ログアウトAPIエラーは無視してリダイレクト
    }
    router.push("/login");
  };

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <nav className="flex items-center gap-6">
          <Link
            href="/reports"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            日報一覧
          </Link>
          <Link
            href="/customers"
            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            顧客一覧
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-muted-foreground">{user.name}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
