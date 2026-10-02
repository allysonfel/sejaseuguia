import { apiTraveler, fail } from "@/lib/api";
import { exportUserData } from "@/lib/export";

// Download imediato dos próprios dados, em JSON.
export async function GET() {
  const u = await apiTraveler();
  if (!u) return fail("Entre de novo para continuar.", 401);
  const data = await exportUserData(u.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-dados-seja-seu-guia.json"`,
    },
  });
}
