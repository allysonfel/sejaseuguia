"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export default function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail);
      setShow(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setShow(false), 2600);
    };
    window.addEventListener("ssg-toast", on);
    return () => window.removeEventListener("ssg-toast", on);
  }, []);
  return (
    <div id="toast" className={show ? "show" : ""} role="status">
      {msg && (
        <>
          <Icon name="check" />
          <span>{msg}</span>
        </>
      )}
    </div>
  );
}
