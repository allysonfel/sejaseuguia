// Toast simples: qualquer componente cliente chama toast("...") e o
// <Toaster/> do layout raiz mostra a mensagem.
export function toast(msg: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ssg-toast", { detail: msg }));
}
