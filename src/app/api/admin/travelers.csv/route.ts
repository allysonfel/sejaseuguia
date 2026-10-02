import { apiStaff, fail } from "@/lib/api";
import { listTravelers } from "@/lib/adminLists";

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Lista de viajantes em CSV (separador ";" abre direto no Excel em pt-BR).
export async function GET() {
  if (!(await apiStaff("travelers"))) return fail("Sem acesso.", 403);
  const { rows } = await listTravelers();
  const lines = [
    ["Nome", "E-mail", "Companhia", "Ritmo", "Orçamento", "Interesses", "Viagens", "Cadastro", "Última atividade"].join(";"),
    ...rows.map((r) => [
      r.nome, r.email, r.profile?.comp, r.profile?.ritmo, r.profile?.orc, r.profile?.int.join(", "), r.viagens,
      r.created_at.toISOString().slice(0, 10), r.last_seen_at?.toISOString().slice(0, 16).replace("T", " ") ?? "",
    ].map(cell).join(";")),
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="viajantes.csv"' },
  });
}
