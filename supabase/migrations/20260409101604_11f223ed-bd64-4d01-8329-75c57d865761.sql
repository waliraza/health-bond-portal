
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own role" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Doctor assignments table (created early for cross-references)
CREATE TABLE public.doctor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, patient_id)
);
ALTER TABLE public.doctor_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors can view own assignments" ON public.doctor_assignments
  FOR SELECT USING (auth.uid() = doctor_id);
CREATE POLICY "Patients can view own assignments" ON public.doctor_assignments
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can insert assignments" ON public.doctor_assignments
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'doctor'::app_role) AND auth.uid() = doctor_id
  );
CREATE POLICY "Doctors can delete assignments" ON public.doctor_assignments
  FOR DELETE USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND auth.uid() = doctor_id
  );

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Doctors can view assigned patient profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = profiles.user_id
    )
  );

-- Patients table
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  age INTEGER,
  blood_type TEXT,
  allergies TEXT[] DEFAULT '{}',
  contact_phone TEXT,
  emergency_contact TEXT,
  chronic_conditions TEXT[] DEFAULT '{}',
  current_medications TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own data" ON public.patients
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Patients can update own data" ON public.patients
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Patients can insert own data" ON public.patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Doctors can view assigned patients" ON public.patients
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = patients.user_id
    )
  );

-- Medical records table
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  record_type TEXT NOT NULL DEFAULT 'general',
  doctor_notes TEXT,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own records" ON public.medical_records
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can insert own records" ON public.medical_records
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can update own records" ON public.medical_records
  FOR UPDATE USING (auth.uid() = patient_id);
CREATE POLICY "Patients can delete own records" ON public.medical_records
  FOR DELETE USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can view assigned patient records" ON public.medical_records
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = medical_records.patient_id
    )
  );
CREATE POLICY "Doctors can update assigned patient records" ON public.medical_records
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = medical_records.patient_id
    )
  );

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  file_path TEXT NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own documents" ON public.documents
  FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Patients can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = patient_id);
CREATE POLICY "Patients can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = patient_id);
CREATE POLICY "Doctors can view assigned patient documents" ON public.documents
  FOR SELECT USING (
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id = documents.patient_id
    )
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON public.medical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for medical documents
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-documents', 'medical-documents', false);

CREATE POLICY "Patients can upload own med docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Patients can view own med docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Patients can delete own med docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'medical-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Doctors can view assigned patient med docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-documents' AND
    public.has_role(auth.uid(), 'doctor'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.doctor_assignments da
      WHERE da.doctor_id = auth.uid() AND da.patient_id::text = (storage.foldername(name))[1]
    )
  );
