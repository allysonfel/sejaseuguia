import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { sql } from "@/lib/db";
import { STAFF_ROLES, type StaffRole } from "@/lib/types";

async function adminsLeft(exceptId: number) {
  const [{ c }] = await sql<{ c: number }[]>`
    SELECT count(*)::int AS c FROM users WHERE kind = 'staff' AND staff_role = 'Administrador' AND id <> ${exceptId}`;
  return c;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await apiStaff("team"))) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  const role = (await readBody<{ role: string }>(req)).role as StaffRole;
  if (!STAFF_ROLES.includes(role)) return fail("Perfil inválido.");
  if (role !== "Administrador" && (await adminsLeft(id)) === 0) return fail("A equipe precisa de pelo menos um Administrador.");
  await sql`UPDATE users SET staff_role = ${role} WHERE id = ${id} AND kind = 'staff'`;
  return ok();
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await apiStaff("team");
  if (!me) return fail("Sem acesso.", 403);
  const id = Number((await ctx.params).id);
  if (id === me.id) return fail("Você não pode remover o próprio acesso.");
  if ((await adminsLeft(id)) === 0) return fail("A equipe precisa de pelo menos um Administrador.");
  await sql`DELETE FROM users WHERE id = ${id} AND kind = 'staff'`;
  return ok();
}
