import { AuthGuard } from "@/components/layout/auth-guard";
import { PanelShell } from "@/components/layout/panel-shell";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PanelShell>{children}</PanelShell>
    </AuthGuard>
  );
}
