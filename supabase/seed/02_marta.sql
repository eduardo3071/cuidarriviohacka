-- GERADO por scripts/build_seed.py. DADOS 100% SINTETICOS (personagem ficticia).
-- Reaplicavel: apaga e recria a paciente Marta (cascade limpa o historico dela).
delete from public.patients where id = 'a1000000-0000-4000-8000-000000000001'::uuid;
delete from public.doctors  where id = 'd1000000-0000-4000-8000-000000000001'::uuid;

insert into public.patients (id, full_name, birth_date, sex)
values ('a1000000-0000-4000-8000-000000000001'::uuid, 'Marta Albuquerque Lima', '1968-03-14'::date, 'F');

insert into public.doctors (id, full_name, crm)
values ('d1000000-0000-4000-8000-000000000001'::uuid, 'Dr. Henrique Tavares', 'CRM-SP 000000 (ficticio)');

insert into public.encounters (patient_id, occurred_at, specialty, provider, notes)
select v.pid, v.d::date, v.specialty, v.provider, v.notes
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2016-05-12', 'Clinica geral', 'Clinica Aurora', 'Check-up anual. Sem queixas.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2018-06-18', 'Clinica geral', 'Clinica Aurora', 'Retorno com exames. Orientada sobre alimentacao e atividade fisica.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2019-08-23', 'Clinica geral', 'Lakeside Medical Centre (exterior)', 'Consulta durante viagem de trabalho. Exames de rotina.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2021-09-06', 'Clinica geral', 'Diagnosticos Vita', 'Retorno com exames. Pressao arterial limítrofe.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2022-02-10', 'Cardiologia', 'Instituto do Coracao Vita', 'Iniciado anti-hipertensivo.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2023-10-20', 'Clinica geral', 'Clinica Aurora', 'Retorno com exames. Suplementacao de vitamina D.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '2025-03-28', 'Cardiologia', 'Instituto do Coracao Vita', 'Relata palpitacoes ocasionais, principalmente a noite.')
) as v(pid, d, specialty, provider, notes);

insert into public.medications (patient_id, name, dose, started_at, ended_at)
select v.pid, v.name, v.dose, v.s::date, v.e::date
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Losartana', '50 mg 1x/dia', '2022-02-10', null),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Vitamina D3', '2000 UI 1x/dia', '2023-10-20', null)
) as v(pid, name, dose, s, e);

insert into public.vaccinations (patient_id, name, dose_number, administered_at)
select v.pid, v.name, v.n::int, v.d::date
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Hepatite B', 1, '2016-06-01'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Hepatite B', 2, '2016-07-01'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Hepatite B', 3, '2016-12-01'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'dTpa', 1, '2019-09-10'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'COVID-19', 1, '2021-07-14'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'COVID-19', 2, '2021-10-06'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'COVID-19', 3, '2022-04-20'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Influenza', 1, '2023-04-25'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Influenza', 1, '2024-04-23'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Influenza', 1, '2025-04-22'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Herpes-zoster', 1, '2025-06-10'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'Herpes-zoster', 2, '2025-09-12')
) as v(pid, name, n, d);

-- observacoes: biomarker_id resolvido pelo alias normalizado (o mesmo caminho da extracao)
insert into public.observations
  (patient_id, biomarker_id, raw_name, value, unit, ref_low, ref_high, ref_text, collected_at, lab_name, status)
select 'a1000000-0000-4000-8000-000000000001'::uuid, a.biomarker_id, v.raw_name, v.value::numeric, v.unit,
       v.ref_low::numeric, v.ref_high::numeric, v.ref_text, v.collected_at::date, v.lab_name, 'confirmed'
from (values
  ('glicose em jejum', 'Glicose em jejum', 91, 'mg/dL', 70, 99, '70 - 99', '2016-05-10', 'Laboratorio Aurora'),
  ('hemoglobina glicada hba1c', 'Hemoglobina glicada (HbA1c)', 5.3, '%', 4.0, 5.6, '4,0 - 5,6', '2016-05-10', 'Laboratorio Aurora'),
  ('colesterol total', 'Colesterol total', 196, 'mg/dL', null, 200, '< 200', '2016-05-10', 'Laboratorio Aurora'),
  ('colesterol ldl', 'Colesterol LDL', 118, 'mg/dL', null, 130, '< 130', '2016-05-10', 'Laboratorio Aurora'),
  ('colesterol hdl', 'Colesterol HDL', 58, 'mg/dL', 50, null, '> 50', '2016-05-10', 'Laboratorio Aurora'),
  ('triglicerideos', 'Triglicerídeos', 110, 'mg/dL', null, 150, '< 150', '2016-05-10', 'Laboratorio Aurora'),
  ('creatinina', 'Creatinina', 0.78, 'mg/dL', 0.5, 1.0, '0,50 - 1,00', '2016-05-10', 'Laboratorio Aurora'),
  ('tsh', 'TSH', 2.1, 'µUI/mL', 0.4, 4.0, '0,40 - 4,00', '2016-05-10', 'Laboratorio Aurora'),
  ('hemoglobina', 'Hemoglobina', 13.4, 'g/dL', 12.0, 15.5, '12,0 - 15,5', '2016-05-10', 'Laboratorio Aurora'),
  ('vitamina d 25 oh', 'Vitamina D (25-OH)', 34, 'ng/mL', 30, 100, '30 - 100', '2016-05-10', 'Laboratorio Aurora'),
  ('tgp alt', 'TGP (ALT)', 22, 'U/L', 7, 33, '7 - 33', '2016-05-10', 'Laboratorio Aurora'),
  ('glicose em jejum', 'Glicose em jejum', 95, 'mg/dL', 70, 99, '70 - 99', '2018-06-14', 'Laboratorio Aurora'),
  ('hemoglobina glicada hba1c', 'Hemoglobina glicada (HbA1c)', 5.4, '%', 4.0, 5.6, '4,0 - 5,6', '2018-06-14', 'Laboratorio Aurora'),
  ('colesterol total', 'Colesterol total', 205, 'mg/dL', null, 200, '< 200', '2018-06-14', 'Laboratorio Aurora'),
  ('colesterol ldl', 'Colesterol LDL', 124, 'mg/dL', null, 130, '< 130', '2018-06-14', 'Laboratorio Aurora'),
  ('colesterol hdl', 'Colesterol HDL', 56, 'mg/dL', 50, null, '> 50', '2018-06-14', 'Laboratorio Aurora'),
  ('triglicerideos', 'Triglicerídeos', 128, 'mg/dL', null, 150, '< 150', '2018-06-14', 'Laboratorio Aurora'),
  ('creatinina', 'Creatinina', 0.8, 'mg/dL', 0.5, 1.0, '0,50 - 1,00', '2018-06-14', 'Laboratorio Aurora'),
  ('tsh', 'TSH', 2.6, 'µUI/mL', 0.4, 4.0, '0,40 - 4,00', '2018-06-14', 'Laboratorio Aurora'),
  ('hemoglobina', 'Hemoglobina', 13.2, 'g/dL', 12.0, 15.5, '12,0 - 15,5', '2018-06-14', 'Laboratorio Aurora'),
  ('fasting glucose', 'Fasting Glucose', 5.5, 'mmol/L', 3.9, 5.5, '3.9 - 5.5', '2019-08-21', 'Lakeside Medical Centre'),
  ('hemoglobin a1c', 'Hemoglobin A1c', 39, 'mmol/mol', 20, 42, '20 - 42', '2019-08-21', 'Lakeside Medical Centre'),
  ('total cholesterol', 'Total Cholesterol', 5.4, 'mmol/L', null, 5.2, '< 5.2', '2019-08-21', 'Lakeside Medical Centre'),
  ('ldl c', 'LDL-C', 3.4, 'mmol/L', null, 3.5, '< 3.5', '2019-08-21', 'Lakeside Medical Centre'),
  ('hdl c', 'HDL-C', 1.4, 'mmol/L', 1.3, null, '> 1.3', '2019-08-21', 'Lakeside Medical Centre'),
  ('triglycerides', 'Triglycerides', 1.6, 'mmol/L', null, 1.7, '< 1.7', '2019-08-21', 'Lakeside Medical Centre'),
  ('creatinine', 'Creatinine', 72, 'µmol/L', 45, 90, '45 - 90', '2019-08-21', 'Lakeside Medical Centre'),
  ('tsh', 'TSH', 3.1, 'mIU/L', 0.35, 4.94, '0.35 - 4.94', '2019-08-21', 'Lakeside Medical Centre'),
  ('hemoglobin', 'Hemoglobin', 130, 'g/L', 120, 155, '120 - 155', '2019-08-21', 'Lakeside Medical Centre'),
  ('25 oh vitamin d', '25-OH Vitamin D', 62, 'nmol/L', 50, 125, '50 - 125', '2019-08-21', 'Lakeside Medical Centre'),
  ('alt', 'ALT', 26, 'U/L', 10, 35, '10 - 35', '2019-08-21', 'Lakeside Medical Centre'),
  ('glicemia de jejum', 'Glicemia de jejum', 101, 'mg/dL', 70, 110, '70 - 110', '2021-09-02', 'Diagnosticos Vita'),
  ('hba1c', 'HbA1c', 5.8, '%', 4.0, 5.7, '4,0 - 5,7', '2021-09-02', 'Diagnosticos Vita'),
  ('colesterol total', 'Colesterol Total', 218, 'mg/dL', null, 190, '< 190', '2021-09-02', 'Diagnosticos Vita'),
  ('ldl', 'LDL', 132, 'mg/dL', null, 100, '< 100', '2021-09-02', 'Diagnosticos Vita'),
  ('hdl', 'HDL', 54, 'mg/dL', 50, null, '> 50', '2021-09-02', 'Diagnosticos Vita'),
  ('triglicerides', 'Triglicérides', 150, 'mg/dL', null, 150, '< 150', '2021-09-02', 'Diagnosticos Vita'),
  ('creatinina serica', 'Creatinina sérica', 0.84, 'mg/dL', 0.6, 1.1, '0,60 - 1,10', '2021-09-02', 'Diagnosticos Vita'),
  ('tsh ultrassensivel', 'TSH ultrassensível', 3.8, 'mUI/L', 0.45, 4.5, '0,45 - 4,50', '2021-09-02', 'Diagnosticos Vita'),
  ('hemoglobina hb', 'Hemoglobina (Hb)', 12.9, 'g/dL', 11.7, 15.5, '11,7 - 15,5', '2021-09-02', 'Diagnosticos Vita'),
  ('25 hidroxivitamina d', '25-Hidroxivitamina D', 26, 'ng/mL', 20, 60, '20 - 60', '2021-09-02', 'Diagnosticos Vita'),
  ('alt tgp', 'ALT/TGP', 28, 'U/L', 7, 31, '7 - 31', '2021-09-02', 'Diagnosticos Vita'),
  ('glicose em jejum', 'Glicose em jejum', 106, 'mg/dL', 70, 99, '70 - 99', '2023-10-17', 'Laboratorio Aurora'),
  ('hemoglobina glicada hba1c', 'Hemoglobina glicada (HbA1c)', 5.9, '%', 4.0, 5.6, '4,0 - 5,6', '2023-10-17', 'Laboratorio Aurora'),
  ('colesterol total', 'Colesterol total', 224, 'mg/dL', null, 200, '< 200', '2023-10-17', 'Laboratorio Aurora'),
  ('colesterol ldl', 'Colesterol LDL', 138, 'mg/dL', null, 130, '< 130', '2023-10-17', 'Laboratorio Aurora'),
  ('colesterol hdl', 'Colesterol HDL', 52, 'mg/dL', 50, null, '> 50', '2023-10-17', 'Laboratorio Aurora'),
  ('triglicerideos', 'Triglicerídeos', 162, 'mg/dL', null, 150, '< 150', '2023-10-17', 'Laboratorio Aurora'),
  ('creatinina', 'Creatinina', 0.88, 'mg/dL', 0.5, 1.0, '0,50 - 1,00', '2023-10-17', 'Laboratorio Aurora'),
  ('tsh', 'TSH', 4.2, 'µUI/mL', 0.4, 4.0, '0,40 - 4,00', '2023-10-17', 'Laboratorio Aurora'),
  ('hemoglobina', 'Hemoglobina', 12.6, 'g/dL', 12.0, 15.5, '12,0 - 15,5', '2023-10-17', 'Laboratorio Aurora'),
  ('vitamina d 25 oh', 'Vitamina D (25-OH)', 24, 'ng/mL', 30, 100, '30 - 100', '2023-10-17', 'Laboratorio Aurora'),
  ('tgp alt', 'TGP (ALT)', 32, 'U/L', 7, 33, '7 - 33', '2023-10-17', 'Laboratorio Aurora'),
  ('glicemia de jejum', 'Glicemia de jejum', 111, 'mg/dL', 70, 110, '70 - 110', '2025-03-25', 'Diagnosticos Vita'),
  ('hba1c', 'HbA1c', 6.0, '%', 4.0, 5.7, '4,0 - 5,7', '2025-03-25', 'Diagnosticos Vita'),
  ('colesterol total', 'Colesterol Total', 229, 'mg/dL', null, 190, '< 190', '2025-03-25', 'Diagnosticos Vita'),
  ('ldl', 'LDL', 141, 'mg/dL', null, 100, '< 100', '2025-03-25', 'Diagnosticos Vita'),
  ('hdl', 'HDL', 50, 'mg/dL', 50, null, '> 50', '2025-03-25', 'Diagnosticos Vita'),
  ('triglicerides', 'Triglicérides', 171, 'mg/dL', null, 150, '< 150', '2025-03-25', 'Diagnosticos Vita'),
  ('creatinina serica', 'Creatinina sérica', 0.92, 'mg/dL', 0.6, 1.1, '0,60 - 1,10', '2025-03-25', 'Diagnosticos Vita'),
  ('tsh ultrassensivel', 'TSH ultrassensível', 4.2, 'mUI/L', 0.45, 4.5, '0,45 - 4,50', '2025-03-25', 'Diagnosticos Vita'),
  ('hemoglobina hb', 'Hemoglobina (Hb)', 12.3, 'g/dL', 11.7, 15.5, '11,7 - 15,5', '2025-03-25', 'Diagnosticos Vita'),
  ('25 hidroxivitamina d', '25-Hidroxivitamina D', 22, 'ng/mL', 20, 60, '20 - 60', '2025-03-25', 'Diagnosticos Vita'),
  ('alt tgp', 'ALT/TGP', 35, 'U/L', 7, 31, '7 - 31', '2025-03-25', 'Diagnosticos Vita'),
  ('glicemia de jejum', 'Glicemia de jejum', 118, 'mg/dL', 70, 110, '70 - 110', '2026-09-28', 'Diagnosticos Vita'),
  ('hba1c', 'HbA1c', 6.2, '%', 4.0, 5.7, '4,0 - 5,7', '2026-09-28', 'Diagnosticos Vita'),
  ('colesterol total', 'Colesterol Total', 236, 'mg/dL', null, 190, '< 190', '2026-09-28', 'Diagnosticos Vita'),
  ('ldl', 'LDL', 146, 'mg/dL', null, 100, '< 100', '2026-09-28', 'Diagnosticos Vita'),
  ('hdl', 'HDL', 49, 'mg/dL', 50, null, '> 50', '2026-09-28', 'Diagnosticos Vita'),
  ('triglicerides', 'Triglicérides', 182, 'mg/dL', null, 150, '< 150', '2026-09-28', 'Diagnosticos Vita'),
  ('creatinina serica', 'Creatinina sérica', 0.97, 'mg/dL', 0.6, 1.1, '0,60 - 1,10', '2026-09-28', 'Diagnosticos Vita'),
  ('tsh ultrassensivel', 'TSH ultrassensível', 4.4, 'mUI/L', 0.45, 4.5, '0,45 - 4,50', '2026-09-28', 'Diagnosticos Vita'),
  ('hemoglobina hb', 'Hemoglobina (Hb)', 12.1, 'g/dL', 11.7, 15.5, '11,7 - 15,5', '2026-09-28', 'Diagnosticos Vita'),
  ('25 hidroxivitamina d', '25-Hidroxivitamina D', 21, 'ng/mL', 20, 60, '20 - 60', '2026-09-28', 'Diagnosticos Vita'),
  ('alt tgp', 'ALT/TGP', 38, 'U/L', 7, 31, '7 - 31', '2026-09-28', 'Diagnosticos Vita')
) as v(norm, raw_name, value, unit, ref_low, ref_high, ref_text, collected_at, lab_name)
left join public.biomarker_aliases a on a.alias_normalized = v.norm;
