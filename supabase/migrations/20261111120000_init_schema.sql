-- =====================================================================
-- Rivio Hub de Saude - schema inicial (Fase 1)
-- Principios:
--   * RLS ligado em TODAS as tabelas do schema public.
--   * Paciente enxerga/edita apenas o que e dele.
--   * Medico so le com consentimento ativo (nao revogado, nao expirado)
--     e apenas nas categorias concedidas: exams | history | wearables.
--   * Escritas do pipeline de IA (jobs, ontologia) vem do backend com
--     service_role, que ignora RLS: o backend DEVE checar o dono em codigo.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Identidade
-- ---------------------------------------------------------------------
create table public.patients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  full_name   text not null,
  birth_date  date,
  sex         text check (sex in ('F', 'M', 'O')),
  created_at  timestamptz not null default now()
);

create table public.doctors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users (id) on delete set null,
  full_name   text not null,
  crm         text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Consentimento (estilo open finance: escopo, validade, revogavel)
-- Criada ANTES das funcoes: funcoes SQL validam o corpo na criacao.
-- ---------------------------------------------------------------------
create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  doctor_id   uuid not null references public.doctors (id) on delete cascade,
  categories  text[] not null,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  constraint consents_categories_valid
    check (categories <@ array['exams', 'history', 'wearables']::text[]
           and cardinality(categories) > 0),
  constraint consents_expiry_after_grant check (expires_at > granted_at)
);
create index consents_patient_idx on public.consents (patient_id);
create index consents_doctor_idx on public.consents (doctor_id);

-- ---------------------------------------------------------------------
-- Funcoes de autorizacao (private: nao expostas pela API do Supabase)
-- ---------------------------------------------------------------------
create or replace function private.owns_patient(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patients p
    where p.id = pid and p.user_id = (select auth.uid())
  );
$$;

create or replace function private.is_doctor(did uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.doctors d
    where d.id = did and d.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_consent(pid uuid, category text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consents c
    join public.doctors d on d.id = c.doctor_id
    where d.user_id = (select auth.uid())
      and c.patient_id = pid
      and c.revoked_at is null
      and c.expires_at > now()
      and category = any (c.categories)
  );
$$;

create or replace function private.has_any_consent(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consents c
    join public.doctors d on d.id = c.doctor_id
    where d.user_id = (select auth.uid())
      and c.patient_id = pid
      and c.revoked_at is null
      and c.expires_at > now()
  );
$$;

grant execute on all functions in schema private to authenticated;

create table public.access_log (
  id           bigint generated always as identity primary key,
  doctor_id    uuid not null references public.doctors (id) on delete cascade,
  patient_id   uuid not null references public.patients (id) on delete cascade,
  category     text not null,
  action       text not null default 'view',
  accessed_at  timestamptz not null default now()
);
create index access_log_patient_idx on public.access_log (patient_id, accessed_at desc);
create index access_log_doctor_idx on public.access_log (doctor_id);

-- ---------------------------------------------------------------------
-- Ontologia clinica (normalizacao de nomes e unidades)
-- ---------------------------------------------------------------------
create table public.biomarkers (
  id              uuid primary key default gen_random_uuid(),
  canonical_name  text not null unique,
  category        text,
  unit_canonical  text not null
);

create table public.biomarker_aliases (
  alias_normalized  text primary key,  -- minusculo, sem acento, sem pontuacao
  biomarker_id      uuid not null references public.biomarkers (id) on delete cascade
);
create index biomarker_aliases_biomarker_idx on public.biomarker_aliases (biomarker_id);

create table public.unit_conversions (
  id            uuid primary key default gen_random_uuid(),
  biomarker_id  uuid not null references public.biomarkers (id) on delete cascade,
  from_unit     text not null,
  to_unit       text not null,
  factor        numeric not null,
  "offset"      numeric not null default 0,  -- valor_canonico = valor * factor + offset
  unique (biomarker_id, from_unit, to_unit)
);

-- ---------------------------------------------------------------------
-- Documentos e extracao
-- ---------------------------------------------------------------------
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  storage_path  text not null,
  sha256        text not null,
  mime_type     text not null,
  lab_name      text,
  status        text not null default 'uploaded'
                check (status in ('uploaded', 'processing', 'pending_review', 'confirmed', 'failed')),
  created_at    timestamptz not null default now(),
  -- idempotencia: o mesmo arquivo nao entra duas vezes para o mesmo paciente
  unique (patient_id, sha256)
);
create index documents_patient_idx on public.documents (patient_id);

create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  document_id  uuid references public.documents (id) on delete cascade,
  kind         text not null default 'extraction',
  status       text not null default 'queued'
               check (status in ('queued', 'running', 'succeeded', 'failed')),
  error        text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index jobs_patient_idx on public.jobs (patient_id, created_at desc);
create index jobs_document_idx on public.jobs (document_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------
-- Dados clinicos
-- ---------------------------------------------------------------------
create table public.observations (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references public.patients (id) on delete cascade,
  document_id   uuid references public.documents (id) on delete set null,
  biomarker_id  uuid references public.biomarkers (id),  -- null ate normalizar
  raw_name      text not null,                           -- como aparece no laudo
  value         numeric not null,
  unit          text,
  ref_low       numeric,                                 -- faixa DO LAUDO de origem
  ref_high      numeric,
  ref_text      text,
  collected_at  date not null,
  lab_name      text,
  confidence    numeric check (confidence between 0 and 1),
  source_page   int,
  source_bbox   jsonb,                                   -- {x0,y0,x1,y1} normalizado 0..1
  status        text not null default 'confirmed'
                check (status in ('pending_review', 'confirmed')),
  created_at    timestamptz not null default now(),
  -- idempotencia do confirm: nao duplica a mesma leitura do mesmo documento
  constraint observations_dedupe
    unique nulls not distinct (patient_id, document_id, raw_name, collected_at)
);
create index observations_patient_series_idx
  on public.observations (patient_id, biomarker_id, collected_at);
create index observations_document_idx on public.observations (document_id);
create index observations_biomarker_idx on public.observations (biomarker_id);

create table public.encounters (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients (id) on delete cascade,
  occurred_at  date not null,
  specialty    text,
  provider     text,
  notes        text,
  created_at   timestamptz not null default now()
);
create index encounters_patient_idx on public.encounters (patient_id, occurred_at desc);

create table public.medications (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients (id) on delete cascade,
  name        text not null,
  dose        text,
  started_at  date,
  ended_at    date,
  created_at  timestamptz not null default now()
);
create index medications_patient_idx on public.medications (patient_id);

create table public.vaccinations (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  name             text not null,
  dose_number      int,
  administered_at  date not null,
  created_at       timestamptz not null default now()
);
create index vaccinations_patient_idx on public.vaccinations (patient_id, administered_at desc);

-- ---------------------------------------------------------------------
-- Wearables e alertas
-- ---------------------------------------------------------------------
create table public.wearable_samples (
  id           bigint generated always as identity primary key,
  patient_id   uuid not null references public.patients (id) on delete cascade,
  metric       text not null,   -- heart_rate | resting_hr | hrv | spo2 | sleep_minutes | systolic | diastolic | ...
  value        numeric not null,
  unit         text,
  recorded_at  timestamptz not null,
  source       text not null default 'synthetic'
);
create index wearable_samples_series_idx
  on public.wearable_samples (patient_id, metric, recorded_at);

create table public.alerts (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  kind             text not null,    -- ex.: irregular_rhythm | sleep_apnea_signal | high_blood_pressure
  severity         text not null check (severity in ('info', 'attention', 'urgent')),
  message          text not null,    -- sempre "procure um medico", nunca diagnostico
  evidence         jsonb not null default '{}'::jsonb,  -- pontos/janela que dispararam a regra
  triggered_at     timestamptz not null default now(),
  acknowledged_at  timestamptz
);
create index alerts_patient_idx on public.alerts (patient_id, triggered_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.patients          enable row level security;
alter table public.doctors           enable row level security;
alter table public.consents          enable row level security;
alter table public.access_log        enable row level security;
alter table public.biomarkers        enable row level security;
alter table public.biomarker_aliases enable row level security;
alter table public.unit_conversions  enable row level security;
alter table public.documents         enable row level security;
alter table public.jobs              enable row level security;
alter table public.observations      enable row level security;
alter table public.encounters        enable row level security;
alter table public.medications       enable row level security;
alter table public.vaccinations      enable row level security;
alter table public.wearable_samples  enable row level security;
alter table public.alerts            enable row level security;

-- patients
create policy patients_owner_all on public.patients
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy patients_doctor_select on public.patients
  for select to authenticated
  using (private.has_any_consent(id));

-- doctors: qualquer usuario logado pode listar (o paciente escolhe a quem conceder)
create policy doctors_select_authenticated on public.doctors
  for select to authenticated using (true);
create policy doctors_self_update on public.doctors
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- consents: paciente gerencia os seus; medico ve os concedidos a ele
create policy consents_patient_all on public.consents
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy consents_doctor_select on public.consents
  for select to authenticated
  using (private.is_doctor(doctor_id));

-- access_log: medico registra a propria leitura (so com consentimento); paciente audita
create policy access_log_doctor_insert on public.access_log
  for insert to authenticated
  with check (private.is_doctor(doctor_id) and private.has_any_consent(patient_id));
create policy access_log_patient_select on public.access_log
  for select to authenticated
  using (private.owns_patient(patient_id));

-- ontologia: leitura para logados; escrita so via service_role
create policy biomarkers_select on public.biomarkers
  for select to authenticated using (true);
create policy biomarker_aliases_select on public.biomarker_aliases
  for select to authenticated using (true);
create policy unit_conversions_select on public.unit_conversions
  for select to authenticated using (true);

-- documents / observations -> categoria 'exams'
create policy documents_owner_all on public.documents
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy documents_doctor_select on public.documents
  for select to authenticated
  using (private.has_consent(patient_id, 'exams'));

create policy observations_owner_all on public.observations
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy observations_doctor_select on public.observations
  for select to authenticated
  using (status = 'confirmed' and private.has_consent(patient_id, 'exams'));

-- jobs: paciente so le; escrita pelo backend (service_role)
create policy jobs_owner_select on public.jobs
  for select to authenticated
  using (private.owns_patient(patient_id));

-- encounters / medications / vaccinations -> categoria 'history'
create policy encounters_owner_all on public.encounters
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy encounters_doctor_select on public.encounters
  for select to authenticated
  using (private.has_consent(patient_id, 'history'));

create policy medications_owner_all on public.medications
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy medications_doctor_select on public.medications
  for select to authenticated
  using (private.has_consent(patient_id, 'history'));

create policy vaccinations_owner_all on public.vaccinations
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy vaccinations_doctor_select on public.vaccinations
  for select to authenticated
  using (private.has_consent(patient_id, 'history'));

-- wearable_samples / alerts -> categoria 'wearables'
create policy wearable_samples_owner_all on public.wearable_samples
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy wearable_samples_doctor_select on public.wearable_samples
  for select to authenticated
  using (private.has_consent(patient_id, 'wearables'));

create policy alerts_owner_all on public.alerts
  for all to authenticated
  using (private.owns_patient(patient_id))
  with check (private.owns_patient(patient_id));
create policy alerts_doctor_select on public.alerts
  for select to authenticated
  using (private.has_consent(patient_id, 'wearables'));

-- ---------------------------------------------------------------------
-- Storage: bucket privado 'documents'; caminho = <patient_id>/<arquivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 15 * 1024 * 1024,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy documents_bucket_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.patients p
      where p.id::text = (storage.foldername(name))[1]
        and p.user_id = (select auth.uid())
    )
  );

create policy documents_bucket_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and exists (
      select 1 from public.patients p
      where p.id::text = (storage.foldername(name))[1]
        and p.user_id = (select auth.uid())
    )
  );

create policy documents_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.patients p
      where p.id::text = (storage.foldername(name))[1]
        and p.user_id = (select auth.uid())
    )
  );

create policy documents_bucket_doctor_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from public.patients p
      where p.id::text = (storage.foldername(name))[1]
        and private.has_consent(p.id, 'exams')
    )
  );
