import ProfileQuiz from "@/components/ProfileQuiz";
import { requireTraveler } from "@/lib/auth";
import Wizard from "./Wizard";

export default async function PerfilViajante({ searchParams }: { searchParams: Promise<{ voltar?: string; primeiro?: string; quiz?: string }> }) {
  const u = await requireTraveler();
  const sp = await searchParams;
  const back = sp.voltar?.startsWith("/app") ? sp.voltar : sp.primeiro ? "/app/nova-viagem" : "/app";
  if (sp.quiz) return <ProfileQuiz mode="edit" nome={u.nome} done={back} />;
  return <Wizard initial={u.profile} done={back} first={!!sp.primeiro} quizHref={"/app/perfil-viajante?quiz=1&voltar=" + encodeURIComponent(back)} />;
}
