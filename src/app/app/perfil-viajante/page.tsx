import { requireTraveler } from "@/lib/auth";
import Wizard from "./Wizard";

export default async function PerfilViajante({ searchParams }: { searchParams: Promise<{ voltar?: string; primeiro?: string }> }) {
  const u = await requireTraveler();
  const sp = await searchParams;
  const back = sp.voltar?.startsWith("/app") ? sp.voltar : sp.primeiro ? "/app/nova-viagem" : "/app";
  return <Wizard initial={u.profile} done={back} first={!!sp.primeiro} />;
}
