-- =====================================================================
-- Fase 4: series comparaveis entre laboratorios + linha do tempo
--
-- security_invoker = true: a view roda com as permissoes de QUEM CONSULTA, entao o RLS das tabelas
-- de baixo vale para a view: o paciente ve so o que e dele; o medico so o que o consentimento cobre
-- (categoria 'exams' para as series, 'history' para consultas/remedios/vacinas).
-- A regra de conversao e de bandeira e a MESMA de apps/api/app/services/normalization/series.py.
-- =====================================================================

create or replace view public.observation_series
with (security_invoker = true) as
select
  o.id                 as observation_id,
  o.patient_id,
  o.document_id,
  o.biomarker_id,
  b.canonical_name     as biomarker,
  b.category,
  b.unit_canonical,
  o.collected_at,
  o.lab_name,
  o.raw_name,
  o.value              as raw_value,                 -- o que o laudo disse
  o.unit               as raw_unit,
  o.ref_low            as raw_ref_low,
  o.ref_high           as raw_ref_high,
  o.ref_text,
  o.confidence,
  o.extraction_method,
  n.norm               as normalization,             -- canonical | converted | unit_unknown | unmapped
  round(o.value    * t.factor + t.off, 3) as value,      -- na unidade canonica (null se nao deu para normalizar)
  round(o.ref_low  * t.factor + t.off, 3) as ref_low,    -- faixa DO LAUDO levada a unidade canonica
  round(o.ref_high * t.factor + t.off, 3) as ref_high,
  case                                                   -- pela faixa do PROPRIO laudo, nos valores originais
    when o.ref_low is null and o.ref_high is null then 'no_range'
    when o.ref_high is not null and o.value > o.ref_high then 'above'
    when o.ref_low  is not null and o.value < o.ref_low  then 'below'
    else 'in_range'
  end as flag
from public.observations o
left join public.biomarkers b on b.id = o.biomarker_id
left join lateral (
  select c.factor, c."offset" as off
  from public.unit_conversions c
  where c.biomarker_id = b.id
    and replace(lower(btrim(c.from_unit)), chr(956), chr(181)) = replace(lower(btrim(o.unit)), chr(956), chr(181))
  limit 1
) conv on true
cross join lateral (
  select case
    when b.id is null then 'unmapped'
    when o.unit is null or btrim(o.unit) = '' then 'unit_unknown'
    when replace(lower(btrim(o.unit)), chr(956), chr(181)) = replace(lower(btrim(b.unit_canonical)), chr(956), chr(181)) then 'canonical'
    when conv.factor is not null then 'converted'
    else 'unit_unknown'
  end as norm
) n
cross join lateral (
  select case n.norm when 'canonical' then 1::numeric when 'converted' then conv.factor end as factor,
         case n.norm when 'canonical' then 0::numeric when 'converted' then conv.off end as off
) t;

comment on view public.observation_series is
  'Leituras confirmadas com valor e faixa na unidade canonica + bandeira pela faixa do proprio laudo. security_invoker: respeita o RLS.';

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
from public.vaccinations v;

comment on view public.timeline_events is
  'Linha do tempo unificada: exames (agrupados por data/laboratorio), consultas, remedios e vacinas. security_invoker: respeita o RLS.';

revoke all on public.observation_series, public.timeline_events from public, anon;
grant select on public.observation_series, public.timeline_events to authenticated, service_role;
