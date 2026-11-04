// Gera as imagens da marca a partir dos originais da Lux em mobile/assets/marca/:
//   - public/marca/logo-escuro.png: logo branco e laranja, fundo transparente (telas com fundo azul escuro)
//   - public/marca/logo-claro.png: logo azul e laranja, fundo transparente (telas com fundo claro)
//   - src/app/icon.png (aba do navegador) e src/app/apple-icon.png (atalho no iPhone)
//   - ícones e telas de abertura do Android e do iPhone
// Rodar de novo depois de trocar o logo: node mobile/assets/gerar.mjs
import { mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const marca = (n) => join(raiz, "mobile/assets/marca", n);
const AZUL_MARCA = { r: 0x13, g: 0x00, b: 0x7c }; // fundo da versão azul do logo
const AZUL_APP = "#101B3B"; // fundo das telas do app (abertura emenda com o login)
const LARANJA = [0xfe, 0xa7, 0x05];

// Logo com fundo transparente. A transparência vem da versão preta (preto = logo,
// branco = fundo, bordas suaves) e a cor de cada ponto vem da versão colorida: onde
// ela é laranja fica laranja; onde é azul fica branco (fundo escuro) ou azul (fundo claro).
async function logo(principal) {
  const lado = 1600;
  const preto = await sharp(marca("logo-preto.jpg")).resize(lado, lado, { fit: "fill" }).greyscale().raw().toBuffer();
  const cor = await sharp(marca("logo-cor.jpg")).resize(lado, lado, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const out = Buffer.alloc(lado * lado * 4);
  for (let i = 0; i < lado * lado; i++) {
    const a = 255 - preto[i];
    const r = cor[i * 3], b = cor[i * 3 + 2];
    const laranja = r - b > 40;
    const c = laranja ? LARANJA : principal;
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = a < 12 ? 0 : a;
  }
  return sharp(out, { raw: { width: lado, height: lado, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
}
const logoEscuro = () => logo([255, 255, 255]);
const logoClaro = () => logo([AZUL_MARCA.r, AZUL_MARCA.g, AZUL_MARCA.b]);

// Ícone redondo 3D, com o lado de fora do círculo transparente.
async function icone3d(lado) {
  const base = await sharp(marca("icone-3d.jpg")).trim({ background: "#ffffff", threshold: 40 }).resize(lado, lado, { fit: "fill" }).png().toBuffer();
  const r = lado / 2;
  return sharp(base).ensureAlpha().composite([{ input: Buffer.from(`<svg width="${lado}" height="${lado}"><circle cx="${r}" cy="${r}" r="${r - 0.5}"/></svg>`), blend: "dest-in" }]).png().toBuffer();
}

// Logo centralizado num quadro de cor sólida (ícone quadrado e tela de abertura).
async function quadro(w, h, fundo, largura, transparente = false) {
  const logo = await sharp(await logoEscuro()).resize(Math.round(largura)).png().toBuffer();
  const bg = transparente ? { r: 0, g: 0, b: 0, alpha: 0 } : fundo;
  return sharp({ create: { width: w, height: h, channels: 4, background: bg } }).composite([{ input: logo, gravity: "center" }]).png().toBuffer();
}

const iconeQuadrado = (lado) => quadro(lado, lado, AZUL_MARCA, lado * 0.8).then((b) => sharp(b).flatten({ background: AZUL_MARCA }).png().toBuffer());
// Primeiro plano do ícone adaptável do Android: o logo dentro da área segura (66% do quadro).
const frente = (lado) => quadro(lado, lado, null, lado * 0.6, true);
const abertura = (w, h) => quadro(w, h, AZUL_APP, Math.min(w, h) * 0.42).then((b) => sharp(b).flatten({ background: AZUL_APP }).png().toBuffer());

function pngs(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? pngs(p) : n.endsWith(".png") ? [p] : [];
  });
}
async function gravar(p, buf) {
  await sharp(buf).toFile(p + ".novo");
  renameSync(p + ".novo", p);
}

mkdirSync(join(raiz, "public/marca"), { recursive: true });
await gravar(join(raiz, "public/marca/logo-escuro.png"), await sharp(await logoEscuro()).resize(720).png().toBuffer());
await gravar(join(raiz, "public/marca/logo-claro.png"), await sharp(await logoClaro()).resize(720).png().toBuffer());
await gravar(join(raiz, "src/app/icon.png"), await sharp(await icone3d(192)).png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer());
await gravar(join(raiz, "src/app/apple-icon.png"), await iconeQuadrado(180));

let n = 4;
for (const p of [...pngs(join(raiz, "android/app/src/main/res")), ...pngs(join(raiz, "ios/App/App/Assets.xcassets"))]) {
  const { width: w, height: h } = await sharp(p).metadata();
  const nome = p.split(String.fromCharCode(92)).join("/");
  const buf = /ic_launcher_round/.test(nome) ? await icone3d(w)
    : /ic_launcher_foreground/.test(nome) ? await frente(w)
    : /ic_launcher|AppIcon/.test(nome) ? await iconeQuadrado(w)
    : /splash/.test(nome) ? await abertura(w, h)
    : null;
  if (!buf) continue;
  await gravar(p, buf);
  n++;
}
console.log(n, "imagens geradas");
