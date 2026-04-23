
-- 1. Doctors profile table
CREATE TABLE IF NOT EXISTS public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  specialty TEXT,
  license_number TEXT,
  bio TEXT,
  years_experience INTEGER,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view doctors"
  ON public.doctors FOR SELECT TO authenticated USING (true);

CREATE POLICY "Doctors can insert own profile"
  ON public.doctors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors can update own profile"
  ON public.doctors FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER doctors_updated_at BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Update handle_new_user_role to also create doctor row
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _role app_role;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'user_role', 'patient')::app_role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF _role = 'patient' THEN
    INSERT INTO public.patients (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role = 'doctor' THEN
    INSERT INTO public.doctors (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill doctors rows for existing doctor users
INSERT INTO public.doctors (user_id)
SELECT ur.user_id FROM public.user_roles ur
WHERE ur.role = 'doctor'
ON CONFLICT (user_id) DO NOTHING;

-- 3. Allow everyone authenticated to view profiles of doctors (so patients can see doctor names)
CREATE POLICY "Patients can view doctor profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'patient')
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.user_id AND ur.role = 'doctor')
  );

-- 4. Appointment requests
CREATE TABLE IF NOT EXISTS public.appointment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  doctor_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (patient_id, doctor_id, status)
);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients create own requests"
  ON public.appointment_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id AND has_role(auth.uid(), 'patient'));

CREATE POLICY "Patients view own requests"
  ON public.appointment_requests FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

CREATE POLICY "Doctors view requests to them"
  ON public.appointment_requests FOR SELECT TO authenticated
  USING (auth.uid() = doctor_id AND has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors update requests to them"
  ON public.appointment_requests FOR UPDATE TO authenticated
  USING (auth.uid() = doctor_id AND has_role(auth.uid(), 'doctor'));

CREATE POLICY "Patients cancel own pending requests"
  ON public.appointment_requests FOR DELETE TO authenticated
  USING (auth.uid() = patient_id AND status = 'pending');

-- 5. Trigger: when request approved, auto-create assignment
CREATE OR REPLACE FUNCTION public.handle_request_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.doctor_assignments (doctor_id, patient_id)
    VALUES (NEW.doctor_id, NEW.patient_id)
    ON CONFLICT (doctor_id, patient_id) DO NOTHING;
    NEW.responded_at := now();
  ELSIF NEW.status = 'declined' AND (OLD.status IS DISTINCT FROM 'declined') THEN
    NEW.responded_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_request_status_change
BEFORE UPDATE ON public.appointment_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_request_approval();

-- 6. Allow patients to view their assigned doctors' profile rows
CREATE POLICY "Patients view assigned doctor records"
  ON public.doctors FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = doctors.user_id AND da.patient_id = auth.uid()
    )
  );

-- 7. Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.medical_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;

ALTER TABLE public.doctor_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.appointment_requests REPLICA IDENTITY FULL;
ALTER TABLE public.medical_records REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.patients REPLICA IDENTITY FULL;
ALTER TABLE public.doctors REPLICA IDENTITY FULL;
