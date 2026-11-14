import { useEffect, useState } from "react";
import { Skeleton } from "./ui";

/** Carregando a tela: esqueletos com a altura dos cartões finais (sem animação) e aviso de rede lenta. */
export function ScreenSkeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t); }, []);
  return (
    <div className="screen-loading">
      <Skeleton heights={[36, 20]} label="Carregando a tela" />
      <Skeleton heights={[112, 112, 112]} className="ds-skel-cards" label="Carregando os cartões" />
      {slow && <p role="status" className="caption">A conexão parece lenta. Aguarde mais um pouco, sem fechar esta tela.</p>}
    </div>
  );
}
