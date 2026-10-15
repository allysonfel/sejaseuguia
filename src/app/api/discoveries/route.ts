import { apiTraveler, fail, ok, readBody } from "@/lib/api";
import { ensureSchema, sql } from "@/lib/db";

const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => txt(x, max)).filter(Boolean).slice(0, n) : []);

// Guarda o lugar em "Minhas descobertas": da base (poiId) ou reconhecido só pela IA (ia).
export async function POST(req: Request) {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const b = await readBody<{ poiId: number; ia: Record<string, unknown> }>(req);
  await ensureSchema();
  if (b.ia && typeof b.ia === "object") {
    // Só os campos que a tela mostra, com tamanho limitado.
    const ia = {
      nome: txt(b.ia.nome, 120), resposta: txt(b.ia.resposta, 2000), contexto: txt(b.ia.contexto, 1500), dica: txt(b.ia.dica, 600),
      observar: lista(b.ia.observar, 6, 300), curiosidades: lista(b.ia.curiosidades, 6, 300),
      confianca: ["alta", "media", "baixa"].includes(b.ia.confianca as string) ? (b.ia.confianca as string) : "media",
      poiId: null, naoELugar: false,
    };
    if (!ia.nome) return fail("Lugar inválido.");
    await sql`
      INSERT INTO ia_discoveries (user_id, nome, ia) VALUES (${u.id}, ${ia.nome}, ${sql.json(ia)})
      ON CONFLICT (user_id, nome) DO UPDATE SET ia = EXCLUDED.ia, created_at = now()`;
    return ok();
  }
  const poiId = Number(b.poiId);
  if (!poiId) return fail("Lugar inválido.");
  await sql`
    INSERT INTO discoveries (user_id, poi_id) SELECT ${u.id}, id FROM pois WHERE id = ${poiId}
    ON CONFLICT (user_id, poi_id) DO UPDATE SET created_at = now()`;
  return ok();
}
