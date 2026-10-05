import { redirect } from "next/navigation";
import ProfileQuiz from "@/components/ProfileQuiz";
import { getCurrentUser } from "@/lib/auth";
import { agencyName } from "@/lib/mail";

// Cadastro do viajante em forma de quiz: o perfil sai pronto junto com a conta.
export default async function Cadastro() {
  const u = await getCurrentUser();
  if (u) redirect(u.kind === "staff" ? "/admin" : "/app");
  return (
    <div className="stage">
      <div className="app">
        <ProfileQuiz mode="signup" agency={agencyName()} />
      </div>
    </div>
  );
}
