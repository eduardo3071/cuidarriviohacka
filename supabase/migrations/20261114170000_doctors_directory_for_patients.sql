-- Corrige o efeito da migracao 20261113132442 (gerada pelo Lovable).
--
-- Aquela migracao removeu `doctors_select_authenticated` e deixou so duas regras: o medico ve a si mesmo, e o paciente
-- ve medicos que JA tem consentimento com ele. Resultado: um paciente sem nenhum consentimento nao enxerga medico algum
-- e nao consegue escolher a quem liberar acesso ("Liberar para um medico" ficava sem opcoes).
--
-- Mantem a intencao de seguranca (um usuario qualquer logado nao ve o diretorio de medicos), mas devolve o caminho certo:
-- quem e PACIENTE (tem linha em public.patients ligada ao proprio login) ve os medicos. O medico continua vendo a si mesmo
-- (doctors_self_select) e as regras de update nao mudam.
drop policy if exists doctors_patient_directory on public.doctors;
create policy doctors_patient_directory on public.doctors
  for select to authenticated
  using (exists (select 1 from public.patients p where p.user_id = (select auth.uid())));
