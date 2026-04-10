
-- Allow doctors to view all profiles that belong to patients (for browsing/assigning)
CREATE POLICY "Doctors can view all patient profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = profiles.user_id AND ur.role = 'patient'
  )
);

-- Allow doctors to view all patients (for browsing before assignment)
CREATE POLICY "Doctors can view all patients for browsing"
ON public.patients
FOR SELECT
USING (has_role(auth.uid(), 'doctor'::app_role));

-- Allow doctors to insert medical records for assigned patients
CREATE POLICY "Doctors can insert records for assigned patients"
ON public.medical_records
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM doctor_assignments da
    WHERE da.doctor_id = auth.uid() AND da.patient_id = medical_records.patient_id
  )
);

-- Allow doctors to insert documents for assigned patients
CREATE POLICY "Doctors can insert documents for assigned patients"
ON public.documents
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'doctor'::app_role)
  AND EXISTS (
    SELECT 1 FROM doctor_assignments da
    WHERE da.doctor_id = auth.uid() AND da.patient_id = documents.patient_id
  )
);
