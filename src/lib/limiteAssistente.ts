// Limite simples por viajante para não esgotar a cota gratuita da IA.
// Vale para os dois assistentes (viagem e geral) juntos.
const JANELA = 10 * 60_000, MAX_POR_JANELA = 30;
const usos = new Map<number, number[]>();

export function assistenteLiberado(userId: number) {
  const agora = Date.now();
  const l = (usos.get(userId) ?? []).filter((t) => agora - t < JANELA);
  if (l.length >= MAX_POR_JANELA) return false;
  l.push(agora);
  usos.set(userId, l);
  return true;
}
