"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { dmy, relTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { ADMIN_MODULES, STAFF_ROLES, type AdminModule, type Permissions, type StaffRole } from "@/lib/types";

type Staff = { id: number; nome: string; email: string; role: string; seen: string | null };
type Req = { id: number; nome: string; email: string; kind: "export" | "delete"; status: string; at: string; gone: boolean };

export default function TeamAdmin({ meId, staff, perms: p0, requests, lgpd }: {
  meId: number; staff: Staff[]; perms: Permissions; requests: Req[]; lgpd: { total: number; consent: number };
}) {
  const router = useRouter();
  const [perms, setPerms] = useState(p0);
  const [sel, setSel] = useState<StaffRole>("Curador de conteúdo");
  const [invite, setInvite] = useState<{ nome: string; email: string; role: StaffRole } | null>(null);
  const [tempPass, setTempPass] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast(msg);
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function togglePerm(m: AdminModule) {
    if (sel === "Administrador" || m === "overview") return;
    const cur = perms[sel] ?? [];
    const next = { ...perms, [sel]: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] };
    setPerms(next);
    try {
      setPerms((await api<{ perms: Permissions }>("/api/admin/permissions", { method: "PUT", body: { perms: next } })).perms);
    } catch (e) {
      setPerms(perms);
      toast((e as Error).message);
    }
  }

  async function sendInvite() {
    if (!invite) return;
    setErr(null);
    try {
      const r = await api<{ tempPass: string }>("/api/admin/team", { body: invite });
      setTempPass(r.tempPass);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const pct = lgpd.total ? Math.round((lgpd.consent / lgpd.total) * 100) : 100;

  return (
    <>
      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div>
          <div className="panel">
            <div className="panel-h">
              <h3>Equipe</h3>
              <button className="btn btn-navy btn-sm" onClick={() => { setErr(null); setTempPass(null); setInvite({ nome: "", email: "", role: "Curador de conteúdo" }); }}><Icon name="plus" />Convidar</button>
            </div>
            <div className="tw">
              <table>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td><b>{s.nome}</b><div className="muted" style={{ fontSize: 12 }}>{s.email} · visto {relTime(s.seen)}</div></td>
                      <td>
                        <select className="input" value={s.role} onChange={(e) => call(() => api("/api/admin/team/" + s.id, { method: "PATCH", body: { role: e.target.value } }), "Perfil atualizado")}>
                          {STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.id !== meId && (
                          <button className="btn btn-ghost btn-sm" title="Remover acesso" aria-label="Remover acesso"
                            onClick={() => confirm("Remover o acesso de " + s.nome + "?") && call(() => api("/api/admin/team/" + s.id, { method: "DELETE" }), "Acesso removido")}>
                            <Icon name="trash" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h"><h3>Permissões por perfil</h3></div>
            <div className="panel-b" style={{ paddingBottom: 6 }}>
              <div className="toolbar" style={{ marginBottom: 10 }}>
                {STAFF_ROLES.map((r) => <button key={r} className={"chip " + (sel === r ? "on" : "")} onClick={() => setSel(r)}>{r}</button>)}
              </div>
              {ADMIN_MODULES.map(([m, label]) => {
                const on = sel === "Administrador" || (perms[sel] ?? []).includes(m) || m === "overview";
                const locked = sel === "Administrador" || m === "overview";
                return (
                  <div key={m} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                    <span>{label}{locked && <span className="muted" style={{ fontSize: 12 }}> · sempre</span>}</span>
                    <button className={"ck " + (on ? "on" : "")} onClick={() => togglePerm(m)} disabled={locked} aria-label={label}>{on && <Icon name="check" />}</button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div>
          <div className="panel">
            <div className="panel-h"><h3>LGPD</h3></div>
            <div className="rank">
              <div className="r"><b style={{ flex: 1, fontWeight: 600 }}>Consentimento no cadastro</b><span className="muted">{pct}% dos viajantes ({lgpd.consent} de {lgpd.total})</span></div>
              <div className="r"><b style={{ flex: 1, fontWeight: 600 }}>Localização</b><span className="muted" style={{ textAlign: "right" }}>Só no aparelho, quando o viajante usa; pode desligar em Privacidade</span></div>
              <div className="r"><b style={{ flex: 1, fontWeight: 600 }}>Portabilidade</b><span className="muted" style={{ textAlign: "right" }}>O viajante baixa os próprios dados no app, a qualquer hora</span></div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-h"><h3>Pedidos de titulares</h3></div>
            <div className="tw">
              <table>
                <tbody>
                  {requests.length === 0 && <tr className="empty-row"><td>Nenhum pedido.</td></tr>}
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.nome}</b><br /><small className="muted">{r.kind === "delete" ? "Excluir minha conta" : "Exportar meus dados"} · {dmy(r.at.slice(0, 10))}</small></td>
                      <td style={{ textAlign: "right" }}>
                        {r.status !== "Pendente" ? <span className="badge b-sea">Concluído</span> : r.kind === "export" ? (
                          <a className="btn btn-navy btn-sm" href={"/api/admin/privacy/" + r.id} onClick={() => setTimeout(() => router.refresh(), 1500)}>Baixar dados</a>
                        ) : (
                          <button className="btn btn-navy btn-sm" onClick={() => confirm("Excluir a conta de " + r.nome + " (" + r.email + ") e todas as viagens dela? Não dá para desfazer.") && call(() => api("/api/admin/privacy/" + r.id, { body: {} }), "Conta excluída e pedido concluído")}>
                            Atender
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {invite && (
        <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && setInvite(null)}>
          <div className="modal">
            <div className="modal-h"><h3>Convidar para a equipe</h3><button onClick={() => setInvite(null)} aria-label="Fechar"><Icon name="close" /></button></div>
            <div className="modal-b">
              {tempPass ? (
                <>
                  <p>Acesso criado para <b>{invite.email}</b>. Passe a senha provisória para a pessoa (ela também foi enviada por e-mail, se o envio estiver configurado):</p>
                  <div className="temp-pass">{tempPass}</div>
                  <small className="muted">Essa senha não aparece de novo. A pessoa pode trocar em “Esqueci minha senha”.</small>
                </>
              ) : (
                <>
                  {err && <div className="err">{err}</div>}
                  <div className="field"><label>Nome</label><input className="input" value={invite.nome} onChange={(e) => setInvite({ ...invite, nome: e.target.value })} /></div>
                  <div className="field"><label>E-mail</label><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
                  <div className="field"><label>Perfil</label><select className="input full" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as StaffRole })}>{STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
                </>
              )}
            </div>
            <div className="modal-f">
              {tempPass ? <button className="btn btn-sun" onClick={() => setInvite(null)}>Fechar</button> : (
                <>
                  <button className="btn btn-ghost" onClick={() => setInvite(null)}>Cancelar</button>
                  <button className="btn btn-sun" onClick={sendInvite}>Criar acesso</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
