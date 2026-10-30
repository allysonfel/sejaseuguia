import Link from "next/link";
import LegalPage, { cnpjAgencia, emailSuporte } from "@/components/legal/LegalPage";
import { agencyName } from "@/lib/mail";

export const metadata = { title: "Termos de uso" };

// Minuta para revisão jurídica da agência. Planos, preços, pagamento e reembolso entram aqui
// quando a cobrança (Cakto e lojas) for ligada.
export default function Termos() {
  const agencia = agencyName(), email = emailSuporte(), cnpj = cnpjAgencia();
  return (
    <LegalPage title="Termos de uso" sub="Seja Seu Guia">
      <p className="muted">Atualizados em 29/10/2026.</p>
      <p>
        Estes termos valem para o uso do app Seja Seu Guia, oferecido pela {agencia}{cnpj ? `, CNPJ ${cnpj}` : ""}. Ao criar a conta, você concorda com eles e com
        a <Link className="link" href="/privacidade">política de privacidade</Link>.
      </p>

      <h2>O que o app faz</h2>
      <p>O Seja Seu Guia monta roteiros de viagem a partir do seu perfil, ajuda durante a viagem (mapa, caminho, assistente, reconhecimento de lugares pela foto) e gera o roteiro em PDF.</p>

      <h2>Informações dos roteiros</h2>
      <ul>
        <li>Horários, preços, ingressos e funcionamento dos lugares vêm de pesquisas automáticas e de fontes abertas e podem mudar sem aviso. Confira com o lugar antes de ir, principalmente o que exige reserva.</li>
        <li>As respostas do assistente e do reconhecimento por foto são geradas por inteligência artificial e podem conter erros.</li>
        <li>Tempos de deslocamento são estimativas. Para o caminho exato, use o app de mapas.</li>
        <li>O app não faz reservas nem vende ingressos de terceiros. Reservas feitas em outros sites seguem as regras de quem vendeu.</li>
      </ul>

      <h2>Sua conta</h2>
      <ul>
        <li>Você precisa ter 18 anos ou mais e informar um e-mail válido.</li>
        <li>A senha é pessoal. Avise a gente se perceber uso que não foi seu.</li>
        <li>Você é responsável pelo que escreve no app e pelas pessoas que convida para as suas viagens.</li>
        <li>Você pode excluir a conta quando quiser, pelo próprio app (<Link className="link" href="/excluir-conta">veja como</Link>).</li>
      </ul>

      <h2>Uso permitido</h2>
      <p>Não é permitido usar o app para fins ilegais, tentar acessar dados de outras pessoas, sobrecarregar o serviço com acessos automáticos ou copiar o conteúdo para revender. Nesses casos, a conta pode ser suspensa.</p>

      <h2>Disponibilidade</h2>
      <p>Trabalhamos para o app funcionar sempre, mas podem acontecer pausas para manutenção ou falhas de serviços de terceiros (mapas, inteligência artificial). Funções novas podem entrar e funções podem mudar.</p>

      <h2>Mudanças nos termos</h2>
      <p>Quando estes termos mudarem, a data no topo é atualizada. Se a mudança for importante, avisamos no app ou por e-mail antes de ela valer.</p>

      <h2>Contato e foro</h2>
      <p>
        Dúvidas{email ? <>: <a className="link" href={`mailto:${email}`}>{email}</a></> : <>: veja a página de <Link className="link" href="/suporte">suporte</Link></>}.
        Vale a lei brasileira, incluindo o Código de Defesa do Consumidor, e o foro do domicílio do consumidor.
      </p>
    </LegalPage>
  );
}
