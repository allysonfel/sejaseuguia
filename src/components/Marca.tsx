// Logo do Seja Seu Guia: "escuro" (branco e laranja) para fundo azul escuro,
// "claro" (azul e laranja) para fundo claro. As imagens saem de mobile/assets/gerar.mjs.
export default function Marca({ altura = 44, fundo = "escuro" }: { altura?: number; fundo?: "escuro" | "claro" }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="marca" src={`/marca/logo-${fundo}.png`} alt="Seja Seu Guia" height={altura} width={Math.round(altura * 1.73)} style={{ height: altura, width: "auto" }} />;
}
