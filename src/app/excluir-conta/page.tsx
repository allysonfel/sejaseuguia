import Link from "next/link";
import LegalPage, { emailSuporte } from "@/components/legal/LegalPage";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Excluir conta" };

// Link público de exclusão de conta (o Google Play exige um endereço na web, fora do app).
export default async function ExcluirConta() {
  const u = await getCurrentUser();
  const email = emailSuporte();
  return (
    <LegalPage title="Excluir conta" sub="Seja Seu Guia">
      <p>Você pode excluir a sua conta do Seja Seu Guia a qualquer momento, pelo app ou por aqui:</p>
      <ul>
        <li>No app: <b>Perfil</b>, depois <b>Privacidade e dados</b>, e <b>Excluir minha conta</b>. Confirme com a sua senha.</li>
        <li>Pelo navegador: entre na sua conta e siga o mesmo caminho.</li>
      </ul>
      <Link className="btn btn-sun btn-block" href={u?.kind === "traveler" ? "/app/privacidade" : "/entrar"}>
        {u?.kind === "traveler" ? "Ir para Privacidade e dados" : "Entrar para excluir a conta"}
      </Link>

      <h2>O que é apagado</h2>
      <p>Na hora, apagamos a conta, o perfil de viajante, as viagens que você criou (para você e para quem você convidou), reservas, anotações, avaliações e descobertas. Nas viagens de outras pessoas, você deixa de participar. Guardamos apenas o registro de que a exclusão foi feita.</p>
      <p>Antes de excluir, se quiser, baixe uma cópia em Privacidade e dados, Exportar meus dados.</p>

      <h2>Não consegue entrar?</h2>
      <p>
        {email
          ? <>Escreva para <a className="link" href={`mailto:${email}`}>{email}</a> a partir do e-mail da conta, pedindo a exclusão. Respondemos em até 15 dias.</>
          : <>Use Esqueci minha senha na tela de <Link className="link" href="/entrar">entrar</Link> para criar uma senha nova e depois exclua a conta pelo app.</>}
      </p>
    </LegalPage>
  );
}
