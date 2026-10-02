// Envio de e-mail pela Resend (opcional). Sem RESEND_API_KEY/MAIL_FROM,
// a mensagem vai para o log do servidor, o que basta em desenvolvimento.
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    console.log(`[e-mail não enviado: Resend não configurado]\nPara: ${to}\nAssunto: ${subject}\n${text}\n`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) console.error("Falha ao enviar e-mail:", res.status, await res.text());
  return res.ok;
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3100").replace(/\/$/, "");
export const agencyName = () => process.env.AGENCY_NAME || "Lux Viagens e Turismo";
