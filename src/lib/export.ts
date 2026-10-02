import { getUserById } from "./auth";
import { listReservations, listTripsForUser } from "./data";
import { sql } from "./db";

/** Tudo o que guardamos sobre uma pessoa (portabilidade da LGPD). */
export async function exportUserData(userId: number) {
  const u = await getUserById(userId);
  if (!u) return null;
  const trips = (await listTripsForUser(u)).filter((t) => t.ownerId === u.id);
  const reservations = await listReservations(trips.map((t) => t.id));
  const ratings = await sql`SELECT r.trip_id, p.nome AS lugar, r.stars, r.created_at FROM ratings r JOIN pois p ON p.id = r.poi_id WHERE r.user_id = ${u.id}`;
  const discoveries = await sql`SELECT p.nome AS lugar, d.created_at FROM discoveries d JOIN pois p ON p.id = d.poi_id WHERE d.user_id = ${u.id}`;
  return {
    geradoEm: new Date().toISOString(),
    conta: { nome: u.nome, email: u.email, criadaEm: u.createdAt, consentimentoEm: u.consentAt, preferencias: u.prefs },
    perfilDeViajante: u.profile,
    viagens: trips.map((t) => ({
      destino: t.destino, inicio: t.inicio, fim: t.fim, hospedagem: t.hotel, pessoas: t.pax, roteiro: t.days,
      reservas: reservations.filter((r) => r.tripId === t.id),
    })),
    avaliacoes: ratings,
    descobertas: discoveries,
  };
}
