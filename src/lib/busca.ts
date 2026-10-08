// Texto de busca de destinos: minúsculo, sem acento e só letras/números,
// para "sao paulo" achar "São Paulo" e "pernambuco" achar Recife.
export const normBusca = (...partes: (string | null | undefined)[]) =>
  partes.filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
