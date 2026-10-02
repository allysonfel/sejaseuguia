import { agencyName } from "@/lib/mail";
import AuthHero from "../entrar/AuthHero";
import ResetForm from "./ResetForm";

export default async function Redefinir({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="auth">
      <AuthHero agency={agencyName()} />
      <div className="auth-form">
        <div className="auth-card">
          <ResetForm token={token ?? ""} />
        </div>
      </div>
    </div>
  );
}
