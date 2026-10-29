// Roteiro em PDF, no estilo do exemplo do Prompt Trip que o cliente mandou: faixa laranja no topo,
// cartão de resumo, índice e seções em cartões. Os dados vêm do roteiro montado (horários e trajetos do
// motor) e do guia do destino (pesquisa do Gemini); sem guia, as seções que dependem dele somem.

import path from "node:path";
import { Circle, Defs, Document, Ellipse, Font, Image as Foto, LinearGradient, Link, Page, Path, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { ClimaMes } from "../clima";
import type { SDay, SItem } from "../engine";
import { dayLabel, durTxt, hm, km1, rangeTxt, daysBetween, faixaTxt } from "../format";
import type { Guia } from "../iaGuia";
import { IC, type IconName } from "../icons";
import type { Telefone } from "../emergencia";
import type { Profile, Reservation, Trip } from "../types";

const FONTES = path.join(process.cwd(), "src", "assets", "fonts");
Font.register({
  family: "Jakarta",
  fonts: [
    { src: path.join(FONTES, "PlusJakartaSans-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONTES, "PlusJakartaSans-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONTES, "PlusJakartaSans-Bold.ttf"), fontWeight: 700 },
    { src: path.join(FONTES, "PlusJakartaSans-ExtraBold.ttf"), fontWeight: 800 },
  ],
});
// Sem hifenização automática: palavra em português quebrada no meio fica estranha.
Font.registerHyphenationCallback((w) => [w]);

// Cores do app (prototype.css) + o laranja do exemplo.
const C = {
  ink: "#121A33", muted: "#5E6782", faint: "#8D95AD", line: "#E3E7F0", navy: "#101B3B",
  sun: "#FFB21E", sunBg: "#FFF3D9", laranja: "#F97316", fundo: "#FFF8EE",
  sea: "#0E9F8E", seaBg: "#E1F4F1", seaInk: "#08695E", coral: "#EE4B55", coralBg: "#FDE8E9",
  violetBg: "#EEEAFF", azulBg: "#E8F0FE",
};

const s = StyleSheet.create({
  page: { backgroundColor: C.fundo, paddingTop: 0, paddingBottom: 44, paddingHorizontal: 0, fontFamily: "Jakarta", fontSize: 9.5, color: C.ink, lineHeight: 1.45 },
  corpo: { paddingHorizontal: 28 },
  topo: { height: 74, justifyContent: "center", paddingHorizontal: 28, marginBottom: 16 },
  topoT: { color: "#fff", fontSize: 19, fontWeight: 800, lineHeight: 1.2 },
  topoS: { color: "#fff", fontSize: 9.5, lineHeight: 1.3, marginTop: 3 },
  resumo: { backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#FDBA74", borderRadius: 12, padding: 14, flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  resumoItem: { width: "33.33%", paddingVertical: 6, paddingRight: 8 },
  rotulo: { color: C.laranja, fontSize: 8.5, fontWeight: 700, marginBottom: 2 },
  valor: { fontSize: 10.5, fontWeight: 600 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.line },
  secT: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  secIc: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.sunBg, alignItems: "center", justifyContent: "center", marginRight: 10 },
  secTxt: { fontSize: 15, fontWeight: 800 },
  p: { marginBottom: 6, color: "#333B55" },
  caixa: { borderRadius: 10, padding: 10, marginBottom: 8 },
  caixaT: { fontWeight: 700, fontSize: 10, marginBottom: 4 },
  li: { flexDirection: "row", marginBottom: 3 },
  bola: { width: 10, color: C.laranja, fontWeight: 800 },
  liTxt: { flex: 1, color: "#333B55" },
  link: { color: "#0B6BCB", textDecoration: "none", fontWeight: 600 },
  botao: { borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 7, marginRight: 6, flexDirection: "row", alignItems: "center" },
  diaCab: { flexDirection: "row", alignItems: "center", backgroundColor: "#FAFAFA", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: C.line },
  diaNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.laranja, color: "#fff", fontWeight: 800, fontSize: 11, textAlign: "center", paddingTop: 5, marginRight: 10 },
  item: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, marginBottom: 7 },
  hora: { alignSelf: "flex-start", backgroundColor: C.sunBg, color: "#C2410C", fontWeight: 700, fontSize: 9, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, marginBottom: 5 },
  nome: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  sub: { color: C.muted, fontSize: 8.5 },
  selo: { fontSize: 7.5, fontWeight: 700, borderRadius: 5, paddingVertical: 1.5, paddingHorizontal: 5, marginRight: 4 },
  preco: { color: C.seaInk, fontWeight: 700, fontSize: 9, marginTop: 4 },
  trecho: { color: C.faint, fontSize: 8, marginBottom: 5, marginLeft: 4 },
  tabela: { borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  linha: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: C.line },
  rodape: { position: "absolute", bottom: 18, left: 28, right: 28, color: C.faint, fontSize: 7.5 },
});

// Ícones de traço do app (icons.ts) desenhados no PDF.
function Ic({ name, size = 16, color = C.laranja }: { name: IconName; size?: number; color?: string }) {
  const els: ReactNode[] = [];
  const re = /<(path|circle|rect|ellipse)\s([^>]*?)\/?>/g;
  let m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(IC[name]))) {
    const a: Record<string, string> = {};
    for (const [, n, v] of m[2].matchAll(/([a-z-]+)="([^"]*)"/g)) a[n] = v;
    const st = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    const n = Number;
    if (m[1] === "path") els.push(<Path key={k++} d={a.d} {...st} />);
    else if (m[1] === "circle") els.push(<Circle key={k++} cx={n(a.cx)} cy={n(a.cy)} r={n(a.r)} {...st} />);
    else if (m[1] === "ellipse") els.push(<Ellipse key={k++} cx={n(a.cx)} cy={n(a.cy)} rx={n(a.rx)} ry={n(a.ry)} {...st} />);
    else els.push(<Rect key={k++} x={n(a.x ?? 0)} y={n(a.y ?? 0)} width={n(a.width)} height={n(a.height)} rx={n(a.rx ?? 0)} {...st} />);
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24">{els}</Svg>;
}

function Secao({ id, icone, titulo, children, quebra }: { id: string; icone: IconName; titulo: string; children: ReactNode; quebra?: boolean }) {
  return (
    <View id={id} style={s.card} break={quebra}>
      <View style={s.secT} minPresenceAhead={140}>
        <View style={s.secIc}><Ic name={icone} size={17} /></View>
        <Text style={s.secTxt}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

function Lista({ itens }: { itens: string[] }) {
  return <>{itens.map((t, i) => <View key={i} style={s.li}><Text style={s.bola}>•</Text><Text style={s.liTxt}>{t}</Text></View>)}</>;
}

function Caixa({ titulo, icone, fundo, children }: { titulo: string; icone: IconName; fundo: string; children: ReactNode }) {
  return (
    <View style={[s.caixa, { backgroundColor: fundo }]} wrap={false}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Ic name={icone} size={12} color={C.navy} /><Text style={[s.caixaT, { marginBottom: 0, marginLeft: 5 }]}>{titulo}</Text>
      </View>
      {children}
    </View>
  );
}

export const mapsLink = (nome: string, destino: string) =>
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(nome + " " + destino);

const dinheiro = (moeda: string, v: number) => moeda + " " + (Math.round(v * 100) / 100).toLocaleString("pt-BR", { maximumFractionDigits: v < 100 ? 2 : 0 });

export type DadosPdf = {
  trip: Trip;
  dias: SDay[];
  guia: Guia | null;
  clima: ClimaMes | null;
  profile: Profile;
  organizador: string;
  reservas: Reservation[];
  telefones: Telefone[] | null;
  plantaoConsular: string | null;
  foto: Buffer | null;
  geradoEm: string;
};

// Título do dia: o lugar principal quando é um só (parque), senão as regiões do dia.
function tituloDia(d: SDay): string {
  const atr = d.items.filter((i) => !i.poi.meal);
  if (!atr.length) return "Dia livre";
  if (atr.length === 1) return atr[0].poi.nome;
  return d.tema;
}

function alertasDoDia(d: SDay, ultimo: boolean): string[] {
  const out: string[] = [];
  for (const it of d.items) {
    if (it.warn === "fechado") out.push(`${it.poi.nome} costuma fechar nesse dia da semana: confirme antes de ir.`);
    else if (it.warn === "fecha") out.push(`${it.poi.nome} fecha às ${it.poi.fecha}: o horário fica apertado.`);
    if (it.poi.reserva && !it.fixed) out.push(`Agende antes: ${it.poi.nome}.`);
  }
  if (ultimo && d.endFixed) out.push(`Último dia: saída até ${d.endFixed}.`);
  return out.slice(0, 4);
}

function Parada({ it, trip, guia, primeiro }: { it: SItem; trip: Trip; guia: Guia | null; primeiro: boolean }) {
  const preco = guia?.precos[it.poi.id];
  const resumo = it.poi.historia ?? (it.poi.reserva ? null : it.poi.tip);
  return (
    <View wrap={false}>
      <Text style={s.trecho}>{it.tr.min} min {it.tr.modo} · {km1(it.tr.km)} km{primeiro ? " desde a hospedagem" : ""}</Text>
      <View style={[s.item, it.fixed ? { borderColor: C.sea } : {}]}>
        <Text style={s.hora}>{hm(it.ini)} às {hm(it.fim)}</Text>
        <Text style={s.nome}>{it.poi.nome}</Text>
        <Text style={s.sub}>{it.poi.cat}{it.poi.bairro ? " · " + it.poi.bairro : ""} · {durTxt(it.dur ?? it.poi.dur)}</Text>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {it.fixed && <Text style={[s.selo, { backgroundColor: C.seaBg, color: C.seaInk }]}>Reservado às {it.fixed}</Text>}
          {it.poi.reserva && !it.fixed && <Text style={[s.selo, { backgroundColor: C.sunBg, color: "#8A5A00" }]}>Agende antes</Text>}
          {it.poi.meal && <Text style={[s.selo, { backgroundColor: C.violetBg, color: "#4B32C3" }]}>Refeição</Text>}
        </View>
        {resumo && <Text style={[s.p, { marginTop: 4, marginBottom: 0, fontSize: 8.8 }]}>{resumo.length > 320 ? resumo.slice(0, 317).trimEnd() + "…" : resumo}</Text>}
        {it.poi.reserva && it.poi.tip && <Text style={{ fontSize: 8.5, color: "#8A5A00", marginTop: 3 }}>{it.poi.tip}</Text>}
        {preco ? (
          <Text style={s.preco}>{preco.valor != null ? `Ingresso: ${dinheiro(trip.moeda, preco.valor)} por pessoa` : "Entrada grátis ou sem preço confirmado"}{preco.obs ? ` (${preco.obs})` : ""}</Text>
        ) : it.poi.meal ? <Text style={s.preco}>Faixa de preço: {faixaTxt(it.poi.preco, trip.moeda)}</Text> : null}
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <Link src={mapsLink(it.poi.nome, trip.destino)} style={[s.botao, s.link]}><Text>Ver no Google Maps</Text></Link>
        </View>
      </View>
    </View>
  );
}

export function RoteiroPdf(d: DadosPdf) {
  const { trip, dias, guia, clima, profile } = d;
  const n = daysBetween(trip.inicio, trip.fim) + 1;
  const titulo = `Roteiro ${trip.destino} · ${n} ${n === 1 ? "dia" : "dias"}`;
  const subt = `${rangeTxt(trip.inicio, trip.fim)} · ${profile.comp} · ${profile.int.slice(0, 3).join(", ")}`;
  const todos = dias.flatMap((x) => x.items);
  const restaurantes = [...new Map(todos.filter((i) => i.poi.meal).map((i) => [i.poi.id, i.poi])).values()];
  const agendar = [...new Map(todos.filter((i) => i.poi.reserva && !i.fixed).map((i) => [i.poi.id, i.poi])).values()];
  const temOrient = !!guia && (guia.dinheiro.length + guia.transporte.length + guia.apps.length + guia.alertas.length > 0);

  // Resumo financeiro (estimativa por pessoa, sem passagem e hospedagem)
  const ingressos = guia ? todos.reduce((a, i) => a + (guia.precos[i.poi.id]?.valor ?? 0), 0) : 0;
  const alim = guia?.diaria.alimentacao != null ? guia.diaria.alimentacao * n : null;
  const transp = guia?.diaria.transporte != null ? guia.diaria.transporte * n : null;
  const temFin = !!guia && (ingressos > 0 || alim != null || transp != null);
  const totalPessoa = ingressos + (alim ?? 0) + (transp ?? 0);

  const indice: [string, string, string][] = [
    ["sobre", "Sobre " + trip.destino, "Resumo e clima"],
    ...(temOrient || d.telefones ? [["orient", "Orientações gerais", "Dinheiro, transporte, apps e alertas"] as [string, string, string]] : []),
    ...(guia?.pratos.length || restaurantes.length ? [["gastro", "Gastronomia", "Pratos típicos e onde comer"] as [string, string, string]] : []),
    ["roteiro", "Roteiro dia a dia", `${dias.length} ${dias.length === 1 ? "dia detalhado" : "dias detalhados"}`],
    ...(temFin ? [["fin", "Resumo financeiro", "Estimativa por pessoa"] as [string, string, string]] : []),
    ...(agendar.length || d.reservas.length ? [["reservas", "Reservas importantes", "O que garantir antes"] as [string, string, string]] : []),
    ...(guia?.dicas.length ? [["dicas", "Dicas extras", "Fotos, lembranças e segurança"] as [string, string, string]] : []),
  ];

  return (
    <Document title={titulo} author="Seja Seu Guia" creator="Seja Seu Guia" producer="Seja Seu Guia" language="pt-BR">
      <Page size="A4" style={s.page}>
        {/* Faixa do topo: repete em todas as páginas */}
        <View fixed style={s.topo}>
          <Svg style={{ position: "absolute", top: 0, left: 0 }} width={595.28} height={74}>
            <Defs>
              <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#F97316" /><Stop offset="0.6" stopColor="#FFB21E" /><Stop offset="1" stopColor="#FFD84D" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={595.28} height={74} fill="url(#g)" />
          </Svg>
          <Text style={s.topoT}>{titulo}</Text>
          <Text style={s.topoS}>{subt}</Text>
        </View>

        <View style={s.corpo}>
          {d.foto && <Foto src={d.foto} style={{ height: 150, borderRadius: 12, objectFit: "cover", marginBottom: 4 }} />}
          {d.foto && trip.fotoCredito && <Text style={{ fontSize: 7, color: C.faint, marginBottom: 10 }}>{trip.fotoCredito}</Text>}

          <View style={s.resumo} wrap={false}>
            {([
              ["pin", "Destino", `${trip.destino}, ${trip.pais}`],
              ["clock", "Período", rangeTxt(trip.inicio, trip.fim)],
              ["route", "Duração", `${n} ${n === 1 ? "dia" : "dias"}`],
              ["users", "Viajantes", `${trip.pax} ${trip.pax === 1 ? "pessoa" : "pessoas"} (${profile.comp.toLowerCase()})`],
              ["bed", "Hospedagem", trip.hotel.nome],
              ["compass", "Ritmo e orçamento", `${profile.ritmo}, ${profile.orc.toLowerCase()}`],
            ] as [IconName, string, string][]).map(([ic, r, v]) => (
              <View key={r} style={s.resumoItem}>
                <View style={{ flexDirection: "row", alignItems: "center" }}><Ic name={ic} size={10} /><Text style={[s.rotulo, { marginLeft: 3, marginBottom: 0 }]}>{r}</Text></View>
                <Text style={[s.valor, { marginTop: 2 }]}>{v}</Text>
              </View>
            ))}
          </View>

          <Secao id="indice" icone="grid" titulo="Índice">
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {indice.map(([id, t, sub]) => (
                <Link key={id} src={"#" + id} style={{ width: "50%", paddingVertical: 5, paddingRight: 8, textDecoration: "none", color: C.ink }}>
                  <Text style={{ fontWeight: 700, fontSize: 10 }}>{t}</Text>
                  <Text style={{ fontSize: 8, color: C.faint }}>{sub}</Text>
                </Link>
              ))}
            </View>
          </Secao>

          <Secao id="sobre" icone="landmark" titulo={"Sobre " + trip.destino}>
            {guia?.sobre.map((t, i) => <Text key={i} style={s.p}>{t}</Text>)}
            {(guia?.clima || clima) && (
              <Text style={s.p}>
                <Text style={{ fontWeight: 700 }}>Clima no período: </Text>
                {guia?.clima || ""}
                {clima ? `${guia?.clima ? " " : ""}Média dos últimos anos: ${Math.round(clima.tmin)} a ${Math.round(clima.tmax)} °C, com chuva em uns ${Math.round(clima.diasChuva)} dias do mês.` : ""}
              </Text>
            )}
            {!guia && !clima && <Text style={s.p}>Roteiro de {n} {n === 1 ? "dia" : "dias"} montado a partir do seu perfil de viajante.</Text>}
          </Secao>

          {(temOrient || d.telefones) && (
            <Secao id="orient" icone="info" titulo="Orientações gerais" quebra>
              {!!guia?.dinheiro.length && <Caixa titulo="Dinheiro e pagamentos" icone="coin" fundo="#EEFBF3"><Lista itens={guia.dinheiro} /></Caixa>}
              {!!guia?.transporte.length && <Caixa titulo="Como circular" icone="bus" fundo={C.azulBg}><Lista itens={guia.transporte} /></Caixa>}
              {!!guia?.apps.length && <Caixa titulo="Apps úteis" icone="phone" fundo={C.violetBg}><Lista itens={guia.apps.map((a) => `${a.nome}: ${a.para}`)} /></Caixa>}
              {!!guia?.alertas.length && <Caixa titulo="Fique atento" icone="alert" fundo="#FFF1E6"><Lista itens={guia.alertas} /></Caixa>}
              {d.telefones && (
                <Caixa titulo={`Telefones de emergência em ${trip.pais}`} icone="shield" fundo={C.coralBg}>
                  <Lista itens={[...d.telefones.map((t) => `${t.nome}: ${t.numero}`), ...(d.plantaoConsular ? [`Plantão consular do Itamaraty (brasileiros no exterior): ${d.plantaoConsular}`] : [])]} />
                </Caixa>
              )}
            </Secao>
          )}

          {(!!guia?.pratos.length || restaurantes.length > 0) && (
            <Secao id="gastro" icone="fork" titulo="Gastronomia">
              {!!guia?.pratos.length && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={[s.caixaT, { color: C.laranja }]}>O que provar</Text>
                  <Lista itens={guia.pratos.map((p) => `${p.nome}${p.tipo !== "prato" ? ` (${p.tipo})` : ""}: ${p.desc}`)} />
                </View>
              )}
              {restaurantes.length > 0 && (
                <View>
                  <Text style={[s.caixaT, { color: C.laranja, marginTop: 4 }]}>Onde comer no seu roteiro</Text>
                  {restaurantes.map((r) => (
                    <View key={r.id} style={[s.item, { flexDirection: "row", alignItems: "center" }]} wrap={false}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.nome}>{r.nome}</Text>
                        <Text style={s.sub}>{r.cat}{r.bairro ? " · " + r.bairro : ""} · {faixaTxt(r.preco, trip.moeda)}</Text>
                      </View>
                      <Link src={mapsLink(r.nome, trip.destino)} style={[s.botao, s.link]}><Text>Google Maps</Text></Link>
                    </View>
                  ))}
                </View>
              )}
            </Secao>
          )}

          <View id="roteiro" break>
            <View style={s.secT}>
              <View style={s.secIc}><Ic name="route" size={17} /></View>
              <Text style={s.secTxt}>Roteiro dia a dia</Text>
            </View>
            {dias.map((x, i) => {
              const destaques = x.items.filter((it) => !it.poi.meal).slice(0, 3).map((it) => it.poi.nome);
              const alertas = alertasDoDia(x, i === dias.length - 1);
              const custo = guia ? x.items.reduce((a, it) => a + (guia.precos[it.poi.id]?.valor ?? 0), 0) : 0;
              return (
                <View key={i} style={s.card}>
                  {/* Cabeçalho, destaques, alertas e a 1ª parada juntos: o dia não começa sozinho no pé da página. */}
                  <View wrap={false}>
                    <View style={s.diaCab}>
                      <Text style={s.diaNum}>{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 800, fontSize: 11.5 }}>{tituloDia(x)}</Text>
                        <Text style={s.sub}>{dayLabel(x.date)} · saída às {hm(x.start)}, volta às {hm(x.end)}</Text>
                      </View>
                    </View>
                    {destaques.length > 0 && (
                      <View style={[s.caixa, { backgroundColor: "#FFFBEA" }]}>
                        <Text style={{ fontSize: 9 }}><Text style={{ fontWeight: 700 }}>Destaques: </Text>{destaques.join(", ")}.</Text>
                      </View>
                    )}
                    {alertas.length > 0 && (
                      <View style={[s.caixa, { backgroundColor: "#FFF1E6" }]}>
                        {alertas.map((t, k) => <Text key={k} style={{ fontSize: 9, color: "#9A3412", fontWeight: 600 }}>{t}</Text>)}
                      </View>
                    )}
                    {x.items[0] && <Parada it={x.items[0]} trip={trip} guia={guia} primeiro />}
                  </View>
                  {x.items.slice(1).map((it, k) => <Parada key={k} it={it} trip={trip} guia={guia} primeiro={false} />)}
                  {x.items.length > 0 && <Text style={s.trecho}>{x.back.min} min {x.back.modo} de volta à hospedagem · chegada às {hm(x.end)}</Text>}
                  {custo > 0 && (
                    <View style={[s.caixa, { backgroundColor: C.seaBg, marginTop: 4, marginBottom: 0 }]} wrap={false}>
                      <Text style={{ color: C.seaInk, fontWeight: 700 }}>Ingressos do dia: {dinheiro(trip.moeda, custo)} por pessoa</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {temFin && (
            <Secao id="fin" icone="coin" titulo="Resumo financeiro" quebra>
              <Text style={[s.p, { color: C.muted }]}>Estimativa por pessoa, pesquisada para as datas da viagem. Não inclui passagem nem hospedagem. Preços mudam: confirme no site oficial antes de comprar.</Text>
              <View style={s.tabela}>
                {([
                  ["Ingressos e atrações", ingressos > 0 ? ingressos : null],
                  ["Alimentação" + (guia?.diaria.alimentacao != null ? ` (${dinheiro(trip.moeda, guia.diaria.alimentacao)} por dia)` : ""), alim],
                  ["Transporte local" + (guia?.diaria.transporte != null ? ` (${dinheiro(trip.moeda, guia.diaria.transporte)} por dia)` : ""), transp],
                ] as [string, number | null][]).filter(([, v]) => v != null).map(([r, v]) => (
                  <View key={r} style={s.linha}><Text style={{ flex: 1 }}>{r}</Text><Text style={{ fontWeight: 700 }}>{dinheiro(trip.moeda, v!)}</Text></View>
                ))}
                <View style={[s.linha, { backgroundColor: C.sunBg, borderBottomWidth: 0 }]}>
                  <Text style={{ flex: 1, fontWeight: 800 }}>Total por pessoa</Text><Text style={{ fontWeight: 800 }}>{dinheiro(trip.moeda, totalPessoa)}</Text>
                </View>
                {trip.pax > 1 && (
                  <View style={[s.linha, { borderBottomWidth: 0, borderTopWidth: 1 }]}>
                    <Text style={{ flex: 1, fontWeight: 700 }}>Total para {trip.pax} pessoas</Text><Text style={{ fontWeight: 700 }}>{dinheiro(trip.moeda, totalPessoa * trip.pax)}</Text>
                  </View>
                )}
              </View>
            </Secao>
          )}

          {(agendar.length > 0 || d.reservas.length > 0) && (
            <Secao id="reservas" icone="ticket" titulo="Reservas importantes" quebra={!temFin}>
              {agendar.map((p) => {
                const r = guia?.reservas[p.id];
                return (
                  <View key={p.id} style={s.item} wrap={false}>
                    <Text style={s.nome}>{p.nome}</Text>
                    <Text style={[s.p, { marginBottom: 2 }]}>{r?.como || p.tip || "Costuma pedir ingresso ou agendamento: garanta antes de ir."}</Text>
                    <View style={{ flexDirection: "row" }}>
                      {r?.site && <Link src={r.site} style={[s.botao, s.link]}><Text>Site oficial</Text></Link>}
                      <Link src={mapsLink(p.nome, trip.destino)} style={[s.botao, s.link]}><Text>Google Maps</Text></Link>
                    </View>
                  </View>
                );
              })}
              {d.reservas.length > 0 && (
                <View style={{ marginTop: agendar.length ? 6 : 0 }}>
                  <Text style={[s.caixaT, { color: C.laranja }]}>Já reservado</Text>
                  <Lista itens={d.reservas.map((r) => `${r.tipo}: ${r.nome}${r.data ? ` · ${r.data.split("-").reverse().join("/")}` : ""}${r.hora ? ` às ${r.hora}` : ""}${r.codigo ? ` · código ${r.codigo}` : ""}`)} />
                </View>
              )}
            </Secao>
          )}

          {!!guia?.dicas.length && (
            <Secao id="dicas" icone="spark" titulo="Dicas extras">
              <Lista itens={guia.dicas} />
            </Secao>
          )}

          <Text style={{ fontSize: 8, color: C.faint, marginTop: 4 }}>
            Roteiro de {d.organizador} gerado pelo Seja Seu Guia em {d.geradoEm}. Horários e trajetos são estimativas; confira o funcionamento dos lugares antes de sair. O roteiro sempre atualizado fica no app.
          </Text>
        </View>

        {/* Sem número de página: o "render" com o total de páginas refaz o layout e quebra em roteiro longo (react-pdf 4.9). */}
        <Text fixed style={s.rodape}>Seja Seu Guia · Lux Viagens e Turismo</Text>
      </Page>
    </Document>
  );
}
