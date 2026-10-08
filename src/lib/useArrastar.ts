"use client";
import { useEffect, useRef } from "react";

// Arrastar para o lado com o mouse numa fileira com rolagem horizontal (no
// toque o navegador já faz isso sozinho). Se a pessoa arrastou, o clique que
// vem no fim do gesto é ignorado, para não escolher um card sem querer.
export function useArrastar<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inicioX = 0, inicioScroll = 0, ativo = false, arrastou = false;
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      ativo = true;
      arrastou = false;
      inicioX = e.clientX;
      inicioScroll = el.scrollLeft;
    };
    const move = (e: PointerEvent) => {
      if (!ativo) return;
      const dx = e.clientX - inicioX;
      if (!arrastou && Math.abs(dx) > 5) {
        arrastou = true;
        el.classList.add("arrastando");
        el.setPointerCapture(e.pointerId);
      }
      if (arrastou) el.scrollLeft = inicioScroll - dx;
    };
    const up = (e: PointerEvent) => {
      if (!ativo) return;
      ativo = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.classList.remove("arrastando");
    };
    const click = (e: MouseEvent) => {
      if (arrastou) {
        e.preventDefault();
        e.stopPropagation();
        arrastou = false;
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("click", click, true);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("click", click, true);
    };
  }, []);
  return ref;
}
