import Link from "next/link";
import Icon from "@/components/Icon";
import { agencyName } from "@/lib/mail";

// Páginas públicas (sem login): política de privacidade, termos, suporte e exclusão de conta.
// As lojas (App Store e Google Play) pedem o link delas na ficha do app.
export const PAGINAS = [
  { href: "/privacidade", nome: "Privacidade" },
  { href: "/termos", nome: "Termos de uso" },
  { href: "/suporte", nome: "Suporte" },
  { href: "/excluir-conta", nome: "Excluir conta" },
];

export const emailSuporte = () => process.env.AGENCY_SUPPORT_EMAIL || "";
/** CNPJ da agência, quando configurado (aparece como responsável pelos dados). */
export const cnpjAgencia = () => process.env.AGENCY_CNPJ || "";

export default function LegalPage({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="stage">
      <div className="app">
        <div className="a-head">
          <Link className="icon-btn" href="/" aria-label="Voltar"><Icon name="back" /></Link>
          <div className="t" style={{ flex: 1 }}>
            <small>{sub}</small>
            <b>{title}</b>
          </div>
        </div>
        <div className="a-body">
          <div className="pad legal">
            {children}
            <nav className="legal-nav" aria-label="Outras páginas">
              {PAGINAS.map((p) => <Link key={p.href} className="link" href={p.href}>{p.nome}</Link>)}
            </nav>
            <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>{agencyName()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
