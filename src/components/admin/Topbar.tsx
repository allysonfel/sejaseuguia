export default function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div>
        <div className="crumb">Seja Seu Guia · Painel administrativo</div>
        <h1>{title}</h1>
      </div>
      <div className="acts">{children}</div>
    </div>
  );
}
