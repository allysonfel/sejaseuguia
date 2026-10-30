import Link from "next/link";
import LegalPage, { cnpjAgencia, emailSuporte } from "@/components/legal/LegalPage";
import { agencyName } from "@/lib/mail";
import { cobrancaAtiva } from "@/lib/planos";

export const metadata = { title: "Política de privacidade" };

// Política pública (as lojas exigem o link). Quando mudar o que o app coleta ou manda para outra empresa,
// atualizar aqui, o resumo em /app/privacidade e os formulários de privacidade da App Store e do Google Play.
export default function PoliticaPrivacidade() {
  const agencia = agencyName(), email = emailSuporte(), cnpj = cnpjAgencia();
  return (
    <LegalPage title="Política de privacidade" sub="Seja Seu Guia">
      <p className="muted">Atualizada em 29/10/2026.</p>
      <p>
        Esta política explica quais dados o app Seja Seu Guia usa, para quê e com quem eles são compartilhados. O responsável pelos dados é a {agencia}
        {cnpj ? `, CNPJ ${cnpj}` : ""}. {email && <>Fale com a gente em <a className="link" href={`mailto:${email}`}>{email}</a>.</>}
      </p>

      <h2>Dados que você informa</h2>
      <ul>
        <li><b>Conta:</b> nome, e-mail e senha (a senha é guardada embaralhada, nunca em texto).</li>
        <li><b>Perfil de viajante:</b> as respostas do quiz (com quem viaja, ritmo, interesses, orçamento, como se locomove).</li>
        <li><b>Viagens:</b> destino, datas, hotel, número de viajantes, os lugares de cada dia, suas anotações e as pessoas que você convidar.</li>
        <li><b>Reservas:</b> voos, hotéis, ingressos e outras reservas que você cadastrar, com códigos e localizadores.</li>
        {cobrancaAtiva() && <li><b>Compras:</b> os planos que você comprou, o valor, a data e a situação do pagamento. Esses registros ficam guardados pelo prazo que a lei exige, mesmo depois da exclusão da conta, sem o seu nome e e-mail.</li>}
        <li><b>Avaliações e descobertas:</b> as notas que você dá aos lugares e os lugares que você descobriu pelo app.</li>
        <li><b>Foto de perfil</b>, se você escolher uma.</li>
      </ul>

      <h2>Dados usados enquanto você usa o app</h2>
      <ul>
        <li><b>Localização:</b> só quando você usa o Modo Viagem, o Explorar ou o O que é?, e só com a sua permissão. Ela serve para mostrar o que está perto e o caminho; não guardamos o seu histórico de localização. Dá para desligar em Privacidade e dados.</li>
        <li><b>Fotos do O que é?:</b> a foto que você tira para descobrir um lugar é usada só para essa resposta e não fica guardada. Guardamos apenas o nome do lugar reconhecido, para aparecer em Minhas descobertas.</li>
        <li><b>Cookie de sessão:</b> um único cookie mantém você conectado. Não usamos cookies de propaganda nem ferramentas de rastreamento.</li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Montar e reorganizar seus roteiros e preparar o roteiro em PDF.</li>
        <li>Responder às suas perguntas no assistente e reconhecer lugares pela foto.</li>
        <li>Mandar e-mails da conta (recuperar a senha, convites para uma viagem).</li>
        <li>Personalizar as próximas sugestões com as suas avaliações, se você deixar essa opção ligada.</li>
        <li>Manter o app seguro (por exemplo, bloquear tentativas repetidas de senha errada).</li>
      </ul>
      <p>A base legal é o seu consentimento, dado no cadastro, e a execução do serviço que você pediu. Seus dados não são vendidos e não são usados para propaganda.</p>

      <h2>Com quem compartilhamos</h2>
      <p>Só o necessário para cada função, com estas empresas:</p>
      <ul>
        <li><b>Google (Gemini):</b> destino, datas, hotel e perfil de viajante, para pesquisar e escolher os lugares do roteiro e o guia do PDF; e a foto do O que é?. É um plano pago, em que o Google não usa esses dados para treinar os modelos dele. Nome, e-mail e reservas não vão junto.</li>
        <li><b>Groq e Z.ai:</b> o texto que você escreve no assistente, com um resumo das suas viagens e o seu primeiro nome; e a foto do O que é? quando o Gemini não responde. São serviços gratuitos que podem usar o que recebem para melhorar os modelos deles, por isso evite escrever ou fotografar dados pessoais.</li>
        <li><b>OpenStreetMap, Photon e Nominatim:</b> o texto que você busca (por exemplo, o nome do hotel) e a região do destino, para achar endereços; o mapa é carregado deles.</li>
        <li><b>Resend:</b> o seu e-mail, para entregar os e-mails da conta.</li>
        {cobrancaAtiva() && <li><b>Cakto:</b> quando você compra um plano, o pagamento é feito no site da Cakto, que recebe o seu nome, e-mail e os dados do pagamento (Pix ou cartão). O Seja Seu Guia não vê nem guarda os dados do cartão; guarda só o plano comprado, o valor e a situação do pagamento.</li>}
        <li><b>Railway:</b> a empresa onde o app e o banco de dados ficam hospedados.</li>
      </ul>
      <p>Algumas dessas empresas ficam fora do Brasil (principalmente nos Estados Unidos). A transferência é feita só para prestar o serviço, com empresas que seguem regras de proteção de dados.</p>
      <p>As pessoas que você convida para uma viagem veem o roteiro dessa viagem. No PDF, quem só pode ver não recebe os códigos das reservas.</p>

      <h2>Por quanto tempo guardamos</h2>
      <p>Enquanto a sua conta existir. Quando você exclui a conta, apagamos na hora a conta, as viagens que você criou, reservas, avaliações e descobertas. Guardamos apenas o registro de que a exclusão foi feita{cobrancaAtiva() ? " e os registros de compras exigidos por lei" : ""}, sem o seu nome e e-mail.</p>

      <h2>Seus direitos (LGPD)</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li>ver e corrigir seus dados no Perfil;</li>
        <li>baixar uma cópia dos seus dados em Perfil, Privacidade e dados, Exportar meus dados;</li>
        <li>ligar ou desligar o uso da localização e a personalização pelo histórico;</li>
        <li>excluir a sua conta pelo próprio app (<Link className="link" href="/excluir-conta">veja como</Link>);</li>
        <li>retirar o consentimento, o que encerra o uso do app;</li>
        <li>falar com a gente{email ? <> em <a className="link" href={`mailto:${email}`}>{email}</a></> : ""} e, se precisar, com a Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>

      <h2>Crianças</h2>
      <p>O app não é voltado a menores de 18 anos e não coleta de propósito dados de crianças.</p>

      <h2>Mudanças nesta política</h2>
      <p>Quando esta política mudar, a data no topo é atualizada. Se a mudança for importante, avisamos no app ou por e-mail.</p>
    </LegalPage>
  );
}
