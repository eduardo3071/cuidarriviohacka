import { useEffect, useState } from "react";

/** Aviso claro quando a pessoa fica sem internet. */
export function ConnectionNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className="net-notice" role="status">
      <span aria-hidden="true">⚠</span> Você está sem internet. O que já está na tela continua visível; para atualizar ou enviar, conecte-se de novo.
    </p>
  );
}

/** Mensagem de carregamento que avisa quando a rede esta lenta. */
export function Loading({ label = "Carregando…" }: { label?: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <p role="status">
      {label}
      {slow && <span className="muted"> A conexão parece lenta. Aguarde mais um pouco, sem fechar esta tela.</span>}
    </p>
  );
}
