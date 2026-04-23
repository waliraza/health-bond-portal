import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Stethoscope, Save } from 'lucide-react';
import { toast } from 'sonner';

const DoctorProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '' });
  const [doc, setDoc] = useState({
    specialty: '',
    license_number: '',
    bio: '',
    years_experience: '',
    available: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
        supabase.from('doctors').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      if (p.data) setProfile({ full_name: p.data.full_name });
      if (d.data) setDoc({
        specialty: d.data.specialty || '',
        license_number: d.data.license_number || '',
        bio: d.data.bio || '',
        years_experience: d.data.years_experience?.toString() || '',
        available: d.data.available,
      });
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: profile.full_name }).eq('user_id', user.id);
    await supabase.from('doctors').upsert({
      user_id: user.id,
      specialty: doc.specialty || null,
      license_number: doc.license_number || null,
      bio: doc.bio || null,
      years_experience: doc.years_experience ? parseInt(doc.years_experience) : null,
      available: doc.available,
    }, { onConflict: 'user_id' });
    toast.success('Profile saved');
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">My Doctor Profile</h1>
            <p className="text-muted-foreground">Information patients see when searching for a doctor</p>
          </div>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save'}</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-heading flex items-center gap-2"><Stethoscope className="h-5 w-5 text-primary" />Professional Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.full_name} onChange={(e) => setProfile({ full_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input value={doc.specialty} onChange={(e) => setDoc({ ...doc, specialty: e.target.value })} placeholder="e.g., Cardiology" />
              </div>
              <div className="space-y-2">
                <Label>Years of Experience</Label>
                <Input type="number" value={doc.years_experience} onChange={(e) => setDoc({ ...doc, years_experience: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>License Number</Label>
              <Input value={doc.license_number} onChange={(e) => setDoc({ ...doc, license_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea rows={4} value={doc.bio} onChange={(e) => setDoc({ ...doc, bio: e.target.value })} placeholder="Tell patients about your practice..." />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Accepting new patients</p>
                <p className="text-xs text-muted-foreground">When off, patients cannot send you new requests</p>
              </div>
              <Switch checked={doc.available} onCheckedChange={(v) => setDoc({ ...doc, available: v })} />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DoctorProfile;
