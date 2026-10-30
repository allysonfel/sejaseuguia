import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { agencyName } from "@/lib/mail";
import AuthForm from "./AuthForm";
import AuthHero from "./AuthHero";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ equipe?: string; cadastro?: string; excluida?: string }> }) {
  const u = await getCurrentUser();
  if (u) redirect(u.kind === "staff" ? "/admin" : "/app");
  const sp = await searchParams;
  // Links antigos (convites, roteiro compartilhado) ainda apontam pra ?cadastro=1.
  if (sp.cadastro) redirect("/cadastro");
  return (
    <div className="auth">
      <AuthHero agency={agencyName()} />
      <div className="auth-form">
        <div className="auth-card">
          {sp.excluida && <div className="okmsg" role="status">Sua conta foi excluída. Obrigado por ter viajado com a gente.</div>}
          <AuthForm agency={agencyName()} initialTab={sp.equipe ? "equipe" : "viajante"} />
        </div>
      </div>
    </div>
  );
}
