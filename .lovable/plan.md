

## Problem Diagnosis

**Root cause**: After signing up and confirming email, users can sign in (authentication succeeds), but the app gets stuck because:

1. **No role is assigned** -- The `signUp` function in `AuthContext.tsx` tries to insert into `user_roles` and `patients` tables immediately after `supabase.auth.signUp()`. However, since email confirmation is enabled, the user isn't fully authenticated at signup time, so RLS blocks those inserts silently.

2. **Auth page redirect loop** -- The Auth page checks `if (user && role)` before redirecting. Since `role` is always `null` (no role in DB), the user sees the auth page even though they're logged in.

**Evidence**: Both users in the database have confirmed emails and profiles (created by the `handle_new_user` trigger), but the `user_roles` table is empty and the `patients` table has no records.

## Plan

### 1. Fix role assignment via database trigger
Create a new migration that adds a database trigger to automatically assign the user role on signup, using the metadata passed during registration. This is more reliable than client-side inserts that depend on RLS.

- Create a `SECURITY DEFINER` function `handle_new_user_role()` that reads `NEW.raw_user_meta_data->>'user_role'` and inserts into `user_roles`
- If role is `'patient'`, also insert into `patients`
- Attach as an `AFTER INSERT` trigger on `auth.users`

### 2. Update AuthContext signUp function
- Pass `user_role` in the signup metadata (`options.data`)
- Remove the client-side inserts into `user_roles` and `patients` (the trigger handles it now)
- After signup, show success message about email confirmation

### 3. Fix the Auth page for logged-in users without roles
- Handle the edge case where user is logged in but role hasn't loaded yet
- Add a fallback: if user exists but role is null after loading, attempt to re-fetch the role

### 4. Fix existing users
- Run an insert to add roles for the 2 existing users who are missing them

### 5. Fix security issues flagged in scan
- Restrict `user_roles` INSERT policy so users can only self-assign the `'patient'` role (not `'doctor'`)
- Add policy to prevent patients from creating `doctor_assignments`

### Technical Details

**New trigger function**:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
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
$$ LANGUAGE plpgsql;
```

**Updated RLS on user_roles**:
```sql
DROP POLICY "Users can insert their own role" ON public.user_roles;
-- No client-side inserts allowed; only the trigger creates roles
```

**Files modified**: `src/contexts/AuthContext.tsx`, new migration SQL

