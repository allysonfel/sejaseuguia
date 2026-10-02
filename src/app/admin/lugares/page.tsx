import Topbar from "@/components/admin/Topbar";
import PoisAdmin from "@/components/admin/PoisAdmin";
import { requireStaff } from "@/lib/auth";
import { listDestinations, listPois } from "@/lib/data";

export default async function Lugares({ searchParams }: { searchParams: Promise<{ dest?: string; cat?: string; q?: string; status?: string }> }) {
  await requireStaff("pois");
  const sp = await searchParams;
  const dests = await listDestinations();
  const dest = dests.find((d) => d.id === Number(sp.dest)) ?? dests[0];
  const pois = dest ? await listPois(dest.id) : [];
  return (
    <>
      <Topbar title="Pontos de interesse" />
      <div className="content">
        {dest ? (
          <PoisAdmin destinations={dests} dest={dest} pois={pois} cat={sp.cat ?? "Todas"} q={sp.q ?? ""} status={sp.status ?? ""} />
        ) : (
          <div className="panel"><div className="panel-b muted">Cadastre um destino primeiro, em Destinos.</div></div>
        )}
      </div>
    </>
  );
}
