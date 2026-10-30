import Link from "next/link";
import LegalPage, { emailSuporte } from "@/components/legal/LegalPage";
import { agencyName } from "@/lib/mail";

export const metadata = { title: "Suporte" };

// Página de suporte pública (a App Store exige o link na ficha do app).
export default function Suporte() {
  const email = emailSuporte();
  return (
    <LegalPage title="Suporte" sub="Seja Seu Guia">
      <p>
        Precisa de ajuda com o app? Dentro do Seja Seu Guia, toque no Gui (o botão redondo no canto da tela): ele responde as dúvidas mais comuns na hora.
      </p>
      {email ? (
        <p>Se não resolver, escreva para a {agencyName()}: <a className="link" href={`mailto:${email}`}>{email}</a>. Conte o que aconteceu e, se der, mande um print da tela.</p>
      ) : (
        <p>Se não resolver, fale com a {agencyName()} pelo mesmo canal em que você contratou a viagem.</p>
      )}

      <h2>Dúvidas comuns</h2>
      <ul>
        <li><b>Esqueci a senha:</b> na tela de entrar, toque em Esqueci minha senha e siga o link que chega no seu e-mail.</li>
        <li><b>Montar uma viagem:</b> no Início, toque em Planejar nova viagem e escolha destino, datas e hotel. A pesquisa dos lugares leva de 1 a 2 minutos.</li>
        <li><b>Roteiro em PDF:</b> abra a viagem e toque em Baixar roteiro em PDF.</li>
        <li><b>Localização e câmera:</b> o app só pede quando você usa o Modo Viagem, o Explorar ou o O que é?. Dá para mudar nos ajustes do celular.</li>
        <li><b>Excluir a conta:</b> veja <Link className="link" href="/excluir-conta">como excluir</Link>.</li>
      </ul>
    </LegalPage>
  );
}
