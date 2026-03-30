import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";

export default async function Header() {
  const session = await getSession();
  const user = session.user;

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
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
