"use client";
// Recursos do celular quando o Seja Seu Guia roda dentro do app (App Store e Google Play,
// via Capacitor, que abre o próprio site). No navegador comum, cada função cai no jeito web.
import { Capacitor } from "@capacitor/core";
import type { SDay } from "./engine";
import { hm } from "./format";

export const ehApp = () => Capacitor.isNativePlatform();
export const plataforma = () => Capacitor.getPlatform(); // "ios" | "android" | "web"

function base64(blob: Blob): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * Salva um arquivo gerado (PDF do roteiro, exportação de dados). Dentro do app, grava no aparelho
 * e abre a folha de compartilhar do celular (Salvar em Arquivos, WhatsApp, e-mail...): o download
 * por link não funciona dentro do app. No navegador, baixa normalmente.
 */
export async function salvarArquivo(blob: Blob, nome: string, titulo: string) {
  if (!ehApp()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const r = await Filesystem.writeFile({ path: nome, data: await base64(blob), directory: Directory.Cache });
  await Share.share({ title: titulo, files: [r.uri] }).catch((e: Error) => {
    // Fechar a folha de compartilhar sem escolher nada não é erro.
    if (!/cancel/i.test(e.message)) throw e;
  });
}

// ---- Lembretes da viagem (notificação agendada no próprio celular, sem servidor) ----

const CHAVE = "ssg-lembretes";
/** Ids das notificações de uma viagem: 1000 por viagem (véspera, um por dia e um por reserva). */
const idBase = (tripId: number) => tripId * 1000;

export function lembretesLigados(): boolean {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; }
}

/** Pede a permissão de notificação (o sistema mostra o aviso) e liga os lembretes. */
export async function ligarLembretes(): Promise<boolean> {
  if (!ehApp()) return false;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const p = await LocalNotifications.requestPermissions();
  const ok = p.display === "granted";
  try { localStorage.setItem(CHAVE, ok ? "1" : "0"); } catch {}
  return ok;
}

const quando = (data: string, min: number) => {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(a, m - 1, d, Math.floor(min / 60), min % 60);
};

/**
 * Agenda (ou reagenda) os lembretes de uma viagem: na véspera às 19h, no começo de cada dia
 * e 1 h antes de cada horário reservado. Chamado quando o roteiro abre ou muda.
 */
export async function agendarLembretes(tripId: number, destino: string, dias: SDay[]) {
  if (!ehApp() || !lembretesLigados()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
  const base = idBase(tripId);
  const pendentes = await LocalNotifications.getPending();
  const daViagem = pendentes.notifications.filter((n) => n.id >= base && n.id < base + 1000);
  if (daViagem.length) await LocalNotifications.cancel({ notifications: daViagem.map((n) => ({ id: n.id })) });

  const agora = Date.now();
  const lista: { id: number; title: string; body: string; schedule: { at: Date }; extra: { url: string } }[] = [];
  const url = `/app/viagem/${tripId}`;
  if (dias[0]) {
    const vespera = quando(dias[0].date, 19 * 60);
    vespera.setDate(vespera.getDate() - 1);
    lista.push({ id: base, title: `Amanhã começa sua viagem a ${destino}`, body: "Seu roteiro está pronto no app. Boa viagem!", schedule: { at: vespera }, extra: { url } });
  }
  dias.forEach((d, i) => {
    const primeiro = d.items[0];
    if (!primeiro) return;
    // Uma hora antes de sair do hotel, nunca antes das 7h.
    const at = quando(d.date, Math.max(7 * 60, primeiro.ini - primeiro.tr.min - 60));
    lista.push({ id: base + 1 + i, title: `Dia ${i + 1} em ${destino}`, body: `Começa com ${primeiro.poi.nome} às ${hm(primeiro.ini)}.`, schedule: { at }, extra: { url: `${url}?dia=${i}` } });
    d.items.forEach((it, k) => {
      if (!it.fixed) return;
      lista.push({ id: base + 100 + i * 30 + k, title: `${it.poi.nome} às ${it.fixed}`, body: "Horário reservado daqui a 1 hora.", schedule: { at: new Date(quando(d.date, it.ini).getTime() - 3600_000) }, extra: { url: `${url}?dia=${i}` } });
    });
  });
  const futuras = lista.filter((n) => n.schedule.at.getTime() > agora + 60_000).slice(0, 60);
  if (futuras.length) await LocalNotifications.schedule({ notifications: futuras });
}

/** Ajustes do app que valem para todas as telas (chamado uma vez, no layout). */
export async function iniciarApp(navegar: (url: string) => void) {
  if (!ehApp()) return;
  document.documentElement.classList.add("em-app");
  const [{ App }, { SplashScreen }, { StatusBar, Style }, { LocalNotifications }] = await Promise.all([
    import("@capacitor/app"), import("@capacitor/splash-screen"), import("@capacitor/status-bar"), import("@capacitor/local-notifications"),
  ]);
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  // Botão voltar do Android: volta uma tela; na primeira tela, fecha o app.
  App.addListener("backButton", ({ canGoBack }) => (canGoBack ? history.back() : App.exitApp()));
  // Tocar no lembrete abre o dia da viagem.
  LocalNotifications.addListener("localNotificationActionPerformed", (a) => {
    const url = (a.notification.extra as { url?: string } | undefined)?.url;
    if (url?.startsWith("/")) navegar(url);
  });
}
