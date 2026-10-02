"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/client";
import { toast } from "@/lib/toast";
import type { Profile } from "@/lib/types";

// Reduz a foto para 256 px antes de mandar (fica com poucos KB no banco).
function resize(file: File): Promise<string> {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      const s = 256, c = document.createElement("canvas");
      c.width = s; c.height = s;
      const min = Math.min(img.width, img.height);
      c.getContext("2d")!.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, s, s);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = bad;
    img.src = URL.createObjectURL(file);
  });
}

export default function ProfileView({ nome, email, avatar, profile, support, agency }: {
  nome: string; email: string; avatar: string | null; profile: Profile; support: string | null; agency: string;
}) {
  const router = useRouter();
  const [photo, setPhoto] = useState(avatar);
  const [name, setName] = useState(nome);
  const [editing, setEditing] = useState(false);

  async function onFile(f: File | undefined) {
    if (!f) return;
    try {
      const a = await resize(f);
      await api("/api/me", { method: "PUT", body: { avatar: a } });
      setPhoto(a);
      toast("Foto do perfil atualizada");
      router.refresh();
    } catch (e) {
      toast((e as Error).message || "Não deu para usar essa imagem");
    }
  }
  async function saveName() {
    try {
      await api("/api/me", { method: "PUT", body: { nome: name } });
      setEditing(false);
      toast("Nome atualizado");
      router.refresh();
    } catch (e) {
      toast((e as Error).message);
    }
  }
  async function logout() {
    const r = await api<{ redirect: string }>("/api/auth/logout", { body: {} });
    window.location.href = r.redirect;
  }

  const row = (ic: Parameters<typeof Icon>[0]["name"], t: string, s: string, href: string) => (
    <Link className="li" href={href}>
      <span className="li-ic"><Icon name={ic} /></span>
      <div className="li-m"><b>{t}</b><small>{s}</small></div>
      <Icon name="right" />
    </Link>
  );

  return (
    <div className="pad">
      <div className="row" style={{ gap: 14, padding: "4px 0 16px" }}>
        <label className="avatar av-up" title="Trocar foto">
          {photo ? <img src={photo} alt="" /> : <Icon name="user" />}
          <span className="cam"><Icon name="camera" /></span>
          <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <div className="row" style={{ gap: 6 }}>
              <input className="input" style={{ height: 40 }} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <button className="btn btn-navy btn-sm" onClick={saveName}>Salvar</button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{ textAlign: "left" }}><b style={{ fontSize: 17 }}>{name}</b> <Icon name="edit" style={{ width: 14, height: 14, color: "var(--faint)" }} /></button>
          )}
          <div className="muted" style={{ fontSize: 13 }}>{email}</div>
        </div>
      </div>
      <div className="box" style={{ padding: "4px 16px" }}>
        {row("compass", "Perfil de viajante", profile.comp + " · " + profile.ritmo + " · " + profile.orc, "/app/perfil-viajante?voltar=/app/perfil")}
        {row("map", "Explorar lugares", "Mapa do destino da sua próxima viagem", "/app/explorar")}
        {row("lock", "Privacidade e dados", "Consentimentos, exportar ou excluir", "/app/privacidade")}
        {support && (
          <a className="li" href={"mailto:" + support}>
            <span className="li-ic"><Icon name="help" /></span>
            <div className="li-m"><b>Ajuda e suporte</b><small>Fale com a {agency}</small></div>
            <Icon name="right" />
          </a>
        )}
      </div>
      <button className="btn btn-ghost btn-block" onClick={logout} style={{ color: "var(--coral)" }}><Icon name="logout" />Sair</button>
    </div>
  );
}
