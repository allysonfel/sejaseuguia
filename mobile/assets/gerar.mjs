// Gera o ícone e a tela de abertura do app (Android e iPhone) a partir de mobile/assets/icone.svg e abertura.svg.
// Rodar de novo depois de trocar o logo: node mobile/assets/gerar.mjs
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const svg = (n) => join(raiz, "mobile/assets", n);
const AMARELO = "#FFB21E";
const icone = (lado) => sharp(svg("icone.svg"), { density: 400 }).resize(lado, lado).flatten({ background: AMARELO }).png().toBuffer();
// Ícone redondo do Android: o mesmo ícone recortado em círculo.
const redondo = async (lado) => sharp(await icone(lado)).composite([{ input: Buffer.from(`<svg width="${lado}" height="${lado}"><circle cx="${lado / 2}" cy="${lado / 2}" r="${lado / 2}"/></svg>`), blend: "dest-in" }]).png().toBuffer();
// Primeiro plano do ícone adaptável do Android: só a bússola, dentro da área segura (66% do quadro), fundo transparente.
const frente = async (lado) => {
  const miolo = Math.round(lado * 0.5);
  const b = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="#101B3B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/></g></svg>`), { density: 600 }).resize(miolo, miolo).png().toBuffer();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: b, gravity: "center" }]).png().toBuffer();
};
const abertura = (w, h) => sharp(svg("abertura.svg"), { density: 150 }).resize(w, h, { fit: "cover" }).png().toBuffer();

function pngs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? pngs(p) : n.endsWith(".png") ? [p] : [];
  });
}

let n = 0;
for (const p of [...pngs(join(raiz, "android/app/src/main/res")), ...pngs(join(raiz, "ios/App/App/Assets.xcassets"))]) {
  const { width: w, height: h } = await sharp(p).metadata();
  const nome = p.split(String.fromCharCode(92)).join("/");
  const buf = /ic_launcher_round/.test(nome) ? await redondo(w)
    : /ic_launcher_foreground/.test(nome) ? await frente(w)
    : /ic_launcher|AppIcon/.test(nome) ? await icone(w)
    : /splash/.test(nome) ? await abertura(w, h)
    : null;
  if (!buf) continue;
  await sharp(buf).toFile(p + ".novo");
  const { renameSync } = await import("node:fs");
  renameSync(p + ".novo", p);
  n++;
}
console.log(n, "imagens geradas");
