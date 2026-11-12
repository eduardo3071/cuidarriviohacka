-- =====================================================================
-- Fase 5: dados do relogio e alertas
--  * amostras do relogio idempotentes (reimportar o mesmo arquivo nao duplica);
--  * alertas com titulo, versao da regra e chave de deduplicacao (reavaliar no mesmo dia nao duplica);
--  * a linha do tempo passa a mostrar os alertas (security_invoker: o RLS ja decide quem ve o que:
--    o medico so ve alertas com consentimento da categoria 'wearables').
-- =====================================================================

create unique index if not exists wearable_samples_dedupe
  on public.wearable_samples (patient_id, metric, recorded_at, source);

alter table public.alerts
  add column if not exists title text,
  add column if not exists dedupe_key text,                  -- data da avaliacao (AAAA-MM-DD)
  add column if not exists rule_version int not null default 1;

create unique index if not exists alerts_dedupe on public.alerts (patient_id, kind, dedupe_key);

comment on column public.alerts.evidence is
  'Por que disparou: {rule, observed, window{from,to}, series[{metric,unit,points[{t,v}]}], reference_lines?, baseline?, note?}';

create or replace view public.timeline_events
with (security_invoker = true) as
select s.patient_id,
       s.collected_at                         as event_date,
       'exam'::text                           as kind,
       coalesce(s.lab_name, 'Exame')          as title,
       jsonb_build_object(
         'document_id', s.document_id,
         'results', count(*),
         'out_of_range', count(*) filter (where s.flag in ('above', 'below'))
       )                                      as detail
from public.observation_series s
group by s.patient_id, s.collected_at, s.lab_name, s.document_id
union all
select e.patient_id, e.occurred_at, 'encounter', coalesce(e.specialty, 'Consulta'),
       jsonb_build_object('provider', e.provider, 'notes', e.notes)
from public.encounters e
union all
select m.patient_id, m.started_at, 'medication_start', m.name, jsonb_build_object('dose', m.dose)
from public.medications m where m.started_at is not null
union all
select m.patient_id, m.ended_at, 'medication_end', m.name, jsonb_build_object('dose', m.dose)
from public.medications m where m.ended_at is not null
union all
select v.patient_id, v.administered_at, 'vaccine', v.name, jsonb_build_object('dose_number', v.dose_number)
from public.vaccinations v
union all
select a.patient_id,
       (a.triggered_at at time zone 'America/Sao_Paulo')::date,
       'alert',
       coalesce(a.title, a.kind),
       jsonb_build_object('kind', a.kind, 'severity', a.severity, 'message', a.message, 'alert_id', a.id)
from public.alerts a;

comment on view public.timeline_events is
  'Linha do tempo unificada: exames, consultas, remedios, vacinas e alertas do relogio. security_invoker: respeita o RLS.';

-- create or replace view preserva os privilegios, mas reafirma por seguranca
revoke all on public.timeline_events from public, anon;
grant select on public.timeline_events to authenticated, service_role;
