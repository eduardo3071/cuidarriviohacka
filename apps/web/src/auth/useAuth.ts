import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { loadRole, type Role } from "../data/api";
import { supabaseRest } from "../data/rest";

export type AuthState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "error"; message: string }
  | { status: "in"; userId: string; email: string; role: Role };

/** Sessao do Supabase + papel (paciente ou medico). O papel so escolhe a tela: quem protege os dados e o RLS. */
export function useAuth(client: SupabaseClient) {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = ainda lendo
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    client.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, s) => {
      // nao chamar o Supabase aqui dentro (trava o cliente): so guarda a sessao; o efeito abaixo carrega o papel.
      if (alive) setSession(s);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const userId = session?.user.id;
  const email = session?.user.email ?? "";
  useEffect(() => {
    if (session === undefined) return setState({ status: "loading" });
    if (!userId) return setState({ status: "out" });
    let alive = true;
    setState({ status: "loading" });
    loadRole(supabaseRest(client), userId)
      .then((role) => alive && setState({ status: "in", userId, email, role }))
      .catch(() => alive && setState({ status: "error", message: "Não foi possível carregar o seu perfil." }));
    return () => {
      alive = false;
    };
  }, [client, session === undefined, userId, email]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(
    async (mail: string, password: string) => {
      const { error } = await client.auth.signInWithPassword({ email: mail, password });
      return error ? { message: error.message, status: error.status, code: error.code } : null;
    },
    [client],
  );
  const signOut = useCallback(async () => {
    await client.auth.signOut();
  }, [client]);

  return { state, signIn, signOut };
}
