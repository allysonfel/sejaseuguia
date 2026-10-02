import { redirect } from "next/navigation";
import { requireTraveler } from "@/lib/auth";
import { listTripsForUser, pickActiveTrip } from "@/lib/data";

export default async function Roteiro() {
  const u = await requireTraveler();
  const t = pickActiveTrip(await listTripsForUser(u));
  redirect(t ? "/app/viagem/" + t.id : "/app/nova-viagem");
}
