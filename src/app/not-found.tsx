import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">ページが見つかりませんでした。</p>
      <Link
        href="/reports"
        className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        日報一覧へ戻る
      </Link>
    </div>
  );
}
