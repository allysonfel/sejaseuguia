"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export default function TabBar() {
  const path = usePathname();
  const travel = path === "/app/modo-viagem" || path.endsWith("/modo-viagem");
  const on = (p: string) => (p === "/app" ? path === "/app" : path.startsWith(p));
  const tabs: [string, "home" | "route" | "camera" | "user", string][] = [
    ["/app", "home", "Início"],
    ["/app/roteiro", "route", "Roteiro"],
    ["/app/descobrir", "camera", "O que é?"],
    ["/app/perfil", "user", "Perfil"],
  ];
  const item = ([href, ic, label]: (typeof tabs)[number]) => (
    <Link key={href} href={href} className={on(href) || (href === "/app/roteiro" && path.startsWith("/app/viagem") && !travel) ? "on" : ""}>
      <Icon name={ic} />
      {label}
    </Link>
  );
  return (
    <nav className="tabbar">
      {item(tabs[0])}
      {item(tabs[1])}
      <Link href="/app/modo-viagem" className={"mid" + (travel ? " on" : "")}>
        <span className="r"><Icon name="nav" /></span>
        Modo viagem
      </Link>
      {item(tabs[2])}
      {item(tabs[3])}
    </nav>
  );
}
