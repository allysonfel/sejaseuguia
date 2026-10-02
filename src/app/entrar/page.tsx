import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { agencyName } from "@/lib/mail";
import AuthForm from "./AuthForm";
import AuthHero from "./AuthHero";

export default async function Entrar({ searchParams }: { searchParams: Promise<{ equipe?: string; cadastro?: string }> }) {
  const u = await getCurrentUser();
  if (u) redirect(u.kind === "staff" ? "/admin" : "/app");
  const sp = await searchParams;
  return (
    <div className="auth">
      <AuthHero agency={agencyName()} />
      <div className="auth-form">
        <div className="auth-card">
          <AuthForm agency={agencyName()} initialTab={sp.equipe ? "equipe" : "viajante"} initialMode={sp.cadastro ? "signup" : "login"} />
        </div>
      </div>
    </div>
  );
}
