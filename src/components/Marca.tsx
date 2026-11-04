// Logo do Seja Seu Guia (versão branca e laranja, para fundo azul escuro).
// A imagem sai de mobile/assets/gerar.mjs, a partir dos originais da Lux.
export default function Marca({ altura = 44 }: { altura?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="marca" src="/marca/logo-escuro.png" alt="Seja Seu Guia" height={altura} width={Math.round(altura * 1.73)} style={{ height: altura, width: "auto" }} />;
}
