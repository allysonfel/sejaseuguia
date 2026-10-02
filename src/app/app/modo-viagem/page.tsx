import { redirect } from "next/navigation";
import { requireTraveler } from "@/lib/auth";
import { listTripsForUser, pickActiveTrip } from "@/lib/data";

export default async function ModoViagem() {
  const u = await requireTraveler();
  const t = pickActiveTrip(await listTripsForUser(u));
  redirect(t ? "/app/viagem/" + t.id + "/modo-viagem" : "/app/nova-viagem");
}
