DROP POLICY IF EXISTS doctors_select_authenticated ON public.doctors;
CREATE POLICY doctors_self_select ON public.doctors FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY doctors_consented_patient_select ON public.doctors FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consents c WHERE c.doctor_id = doctors.id AND private.owns_patient(c.patient_id)));