import { apiStaff, fail, ok, readBody } from "@/lib/api";
import { setSetting } from "@/lib/db";
import { ADMIN_MODULES, DEFAULT_PERMISSIONS, STAFF_ROLES, type AdminModule, type Permissions } from "@/lib/types";

// Matriz de permissões por perfil. O Administrador sempre vê tudo.
export async function PUT(req: Request) {
  if (!(await apiStaff("team"))) return fail("Sem acesso.", 403);
  const b = await readBody<{ perms: Permissions }>(req);
  const valid = ADMIN_MODULES.map((m) => m[0]) as AdminModule[];
  const perms = {} as Permissions;
  for (const role of STAFF_ROLES) {
    const list = Array.isArray(b.perms?.[role]) ? b.perms![role].filter((m) => valid.includes(m)) : DEFAULT_PERMISSIONS[role];
    perms[role] = role === "Administrador" ? valid : [...new Set<AdminModule>(["overview", ...list])];
  }
  await setSetting("permissions", perms);
  return ok({ perms });
}
