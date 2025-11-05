import { ErrorBoundary } from "@/components/error-boundary";
import { AuthGuard } from "@/components/auth/auth-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthGuard>{children}</AuthGuard>
    </ErrorBoundary>
  );
}

