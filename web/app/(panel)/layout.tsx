import { AuthGuard } from "@/shell/auth-guard";
import { PanelShell } from "@/shell/panel-shell";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PanelShell>{children}</PanelShell>
    </AuthGuard>
  );
}

