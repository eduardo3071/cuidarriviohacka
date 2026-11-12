-- =====================================================================
-- Fase 3: pipeline de documentos (upload -> job -> revisao -> confirmacao)
-- A logica que precisa ser ATOMICA e resistente a corrida fica em funcoes SQL;
-- o backend (FastAPI/SQLAlchemy) so as chama. Executaveis apenas pelo service_role.
-- =====================================================================

alter table public.documents
  add column if not exists page_paths text[] not null default '{}',   -- imagens das paginas (referencia das bbox)
  add column if not exists collected_at date,
  add column if not exists extraction_method text
    check (extraction_method in ('text_layer', 'ocr', 'llm'));

alter table public.jobs
  add column if not exists error_code text;

alter table public.observations
  add column if not exists extraction_method text
    check (extraction_method in ('text_layer', 'ocr', 'llm', 'manual')),
  add column if not exists extraction_notes text[] not null default '{}';

comment on column public.observations.source_bbox is '[x0,y0,x1,y1] normalizado 0..1 na imagem da pagina (documents.page_paths)';

-- ---------------------------------------------------------------------
-- Cria o documento UMA vez por (paciente, sha256) e o job de extracao.
--  * mesmo arquivo de novo      -> devolve o existente (is_new = false), sem novo job
--  * mesmo arquivo apos falha   -> reabre: novo job, status volta a 'uploaded' (is_new = true)
--  * duas requisicoes ao mesmo tempo -> o indice unico serializa; so uma cria
-- ---------------------------------------------------------------------
create or replace function public.create_document_once(
  p_patient uuid, p_storage_path text, p_sha256 text, p_mime text
)
returns table (out_document_id uuid, out_job_id uuid, out_is_new boolean, out_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc uuid;
  v_job uuid;
  v_status text;
begin
  insert into public.documents (patient_id, storage_path, sha256, mime_type)
  values (p_patient, p_storage_path, p_sha256, p_mime)
  on conflict (patient_id, sha256) do nothing
  returning id into v_doc;

  if v_doc is not null then
    insert into public.jobs (patient_id, document_id) values (p_patient, v_doc) returning id into v_job;
    return query select v_doc, v_job, true, 'uploaded'::text;
    return;
  end if;

  select d.id, d.status into v_doc, v_status
  from public.documents d
  where d.patient_id = p_patient and d.sha256 = p_sha256
  for update;

  if v_status = 'failed' then
    update public.documents set status = 'uploaded' where id = v_doc;
    insert into public.jobs (patient_id, document_id) values (p_patient, v_doc) returning id into v_job;
    return query select v_doc, v_job, true, 'uploaded'::text;
    return;
  end if;

  select j.id into v_job
  from public.jobs j
  where j.document_id = v_doc
  order by j.created_at desc
  limit 1;
  return query select v_doc, v_job, false, v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- Confirma a revisao: grava as leituras como 'confirmed' e fecha o documento, numa transacao.
--  * ja confirmado           -> {already: true}, nada muda (repetir a requisicao e seguro)
--  * nao esta em revisao     -> erro document_not_reviewable (P0001)
--  * documento de outro dono -> erro document_not_found (P0002)
--  * mesma leitura repetida no mesmo documento e ignorada (observations_dedupe)
-- ---------------------------------------------------------------------
create or replace function public.confirm_document(
  p_patient uuid, p_document uuid, p_collected_at date, p_lab_name text, p_observations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_count int;
begin
  select d.status into v_status
  from public.documents d
  where d.id = p_document and d.patient_id = p_patient
  for update;

  if not found then
    raise exception 'document_not_found' using errcode = 'P0002';
  end if;

  if v_status = 'confirmed' then
    select count(*) into v_count from public.observations o where o.document_id = p_document;
    return jsonb_build_object('confirmed', v_count, 'submitted', v_count, 'already', true);
  end if;

  if v_status <> 'pending_review' then
    raise exception 'document_not_reviewable' using errcode = 'P0001', detail = v_status;
  end if;

  if jsonb_typeof(p_observations) <> 'array' or jsonb_array_length(p_observations) = 0 then
    raise exception 'no_observations' using errcode = 'P0001';
  end if;

  insert into public.observations (
    patient_id, document_id, biomarker_id, raw_name, value, unit, ref_low, ref_high, ref_text,
    collected_at, lab_name, confidence, source_page, source_bbox, status,
    extraction_method, extraction_notes
  )
  select p_patient, p_document, b.id, r.raw_name, r.value, r.unit, r.ref_low, r.ref_high, r.ref_text,
         p_collected_at, p_lab_name, r.confidence, r.page, r.bbox, 'confirmed',
         r.method, coalesce(r.notes, '{}')
  from jsonb_to_recordset(p_observations) as r(
    raw_name text, canonical_name text, value numeric, unit text, ref_low numeric, ref_high numeric,
    ref_text text, confidence numeric, page int, bbox jsonb, method text, notes text[]
  )
  left join public.biomarkers b on b.canonical_name = r.canonical_name
  on conflict on constraint observations_dedupe do nothing;
  get diagnostics v_count = row_count;

  update public.documents
  set status = 'confirmed',
      collected_at = p_collected_at,
      lab_name = coalesce(p_lab_name, lab_name)
  where id = p_document;

  return jsonb_build_object(
    'confirmed', v_count, 'submitted', jsonb_array_length(p_observations), 'already', false
  );
end;
$$;

revoke all on function public.create_document_once(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.confirm_document(uuid, uuid, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_document_once(uuid, text, text, text) to service_role;
grant execute on function public.confirm_document(uuid, uuid, date, text, jsonb) to service_role;
