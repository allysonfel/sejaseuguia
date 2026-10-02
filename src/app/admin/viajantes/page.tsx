import Icon from "@/components/Icon";
import Topbar from "@/components/admin/Topbar";
import { listTravelers } from "@/lib/adminLists";
import { requireStaff } from "@/lib/auth";
import { dmy, n0, relTime } from "@/lib/format";

export default async function Viajantes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff("travelers");
  const q = (await searchParams).q ?? "";
  const { rows, total } = await listTravelers(q);
  return (
    <>
      <Topbar title="Viajantes">
        <a className="btn btn-ghost btn-sm" href="/api/admin/travelers.csv"><Icon name="download" />Exportar</a>
      </Topbar>
      <div className="content">
        <div className="panel">
          <div className="panel-h">
            <form className="tsearch" action="/admin/viajantes">
              <Icon name="search" />
              <input name="q" placeholder="Buscar por nome ou e-mail" defaultValue={q} />
            </form>
            <span className="muted" style={{ fontSize: 12.5 }}>{n0(total)} viajantes{q ? " · " + rows.length + " encontrados" : ""}</span>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Viajante</th><th>Perfil</th><th className="num">Viagens</th><th>Cadastro</th><th>Última atividade</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr className="empty-row"><td colSpan={5}>Nenhum viajante encontrado.</td></tr>}
                {rows.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.nome}</b><div className="muted" style={{ fontSize: 12 }}>{x.email}</div></td>
                    <td>{x.profile ? x.profile.comp + " · " + x.profile.ritmo.toLowerCase() : <span className="muted">Perfil não preenchido</span>}</td>
                    <td className="num">{x.viagens}</td>
                    <td className="mono muted">{dmy(x.created_at.toISOString())}</td>
                    <td className="muted">{relTime(x.last_seen_at?.toISOString() ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
