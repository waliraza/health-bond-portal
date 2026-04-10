
-- Create trigger function for role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _role app_role;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'user_role', 'patient')::app_role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  IF _role = 'patient' THEN
    INSERT INTO public.patients (user_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on auth.users (profile trigger was missing too)
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Security fix: remove permissive self-insert policy on user_roles
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- Security fix: restrict doctor_assignments inserts to doctors only
CREATE POLICY "Only doctors can insert assignments"
  ON public.doctor_assignments FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'doctor'::app_role) AND auth.uid() = doctor_id);

-- Drop the old broader policy
DROP POLICY IF EXISTS "Doctors can insert assignments" ON public.doctor_assignments;
