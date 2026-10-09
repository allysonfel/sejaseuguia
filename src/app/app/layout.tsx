import AssistenteGeral from "@/components/AssistenteGeral";
import { requireTraveler } from "@/lib/auth";

// Casca do app do viajante: no celular ocupa a tela; no computador vira
// uma coluna com largura de celular, como no protótipo.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireTraveler();
  return (
    <div className="stage">
      <div className="app"><AssistenteGeral>{children}</AssistenteGeral></div>
    </div>
  );
}
