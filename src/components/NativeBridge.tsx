"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { iniciarApp } from "@/lib/nativo";

// Ajustes de quando o site roda dentro do app (Capacitor): barra de status, tela de abertura,
// botão voltar do Android e toque nos lembretes. No navegador não faz nada.
export default function NativeBridge() {
  const router = useRouter();
  useEffect(() => { iniciarApp((url) => router.push(url)).catch(() => {}); }, [router]);
  return null;
}
