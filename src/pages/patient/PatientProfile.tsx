import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Save, Plus, X, Droplets, Phone, AlertTriangle, Pill, Activity } from 'lucide-react';
import { toast } from 'sonner';

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const PatientProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ full_name: '' });
  const [patient, setPatient] = useState({
    age: '',
    blood_type: '',
    contact_phone: '',
    emergency_contact: '',
    allergies: [] as string[],
    chronic_conditions: [] as string[],
    current_medications: [] as string[],
  });
  const [newAllergy, setNewAllergy] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, patientRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).single(),
        supabase.from('patients').select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) setProfile({ full_name: profileRes.data.full_name });
      if (patientRes.data) {
        setPatient({
          age: patientRes.data.age?.toString() || '',
          blood_type: patientRes.data.blood_type || '',
          contact_phone: patientRes.data.contact_phone || '',
          emergency_contact: patientRes.data.emergency_contact || '',
          allergies: patientRes.data.allergies || [],
          chronic_conditions: patientRes.data.chronic_conditions || [],
          current_medications: patientRes.data.current_medications || [],
        });
      }
    };
    fetchData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: profile.full_name }).eq('user_id', user.id);
    const patientData = {
      user_id: user.id,
      age: patient.age ? parseInt(patient.age) : null,
      blood_type: patient.blood_type || null,
      contact_phone: patient.contact_phone || null,
      emergency_contact: patient.emergency_contact || null,
      allergies: patient.allergies,
      chronic_conditions: patient.chronic_conditions,
      current_medications: patient.current_medications,
    };
    await supabase.from('patients').upsert(patientData, { onConflict: 'user_id' });
    toast.success('Profile saved successfully');
    setSaving(false);
  };

  const addToList = (field: 'allergies' | 'chronic_conditions' | 'current_medications', value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    setPatient((prev) => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setter('');
  };

  const removeFromList = (field: 'allergies' | 'chronic_conditions' | 'current_medications', index: number) => {
    setPatient((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal and medical information</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="font-heading flex items-center gap-2"><User className="h-5 w-5 text-primary" />Personal Information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Age</Label>
              <Input type="number" value={patient.age} onChange={(e) => setPatient({ ...patient, age: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Blood Type</Label>
              <Select value={patient.blood_type} onValueChange={(v) => setPatient({ ...patient, blood_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{bloodTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={patient.contact_phone} onChange={(e) => setPatient({ ...patient, contact_phone: e.target.value })} placeholder="+1 555-0123" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Emergency Contact</Label>
              <Input value={patient.emergency_contact} onChange={(e) => setPatient({ ...patient, emergency_contact: e.target.value })} placeholder="Name & phone number" />
            </div>
          </CardContent>
        </Card>

        {[
          { field: 'allergies' as const, icon: AlertTriangle, label: 'Allergies', color: 'destructive', value: newAllergy, setter: setNewAllergy },
          { field: 'chronic_conditions' as const, icon: Activity, label: 'Chronic Conditions', color: 'default', value: newCondition, setter: setNewCondition },
          { field: 'current_medications' as const, icon: Pill, label: 'Current Medications', color: 'secondary', value: newMedication, setter: setNewMedication },
        ].map((section) => (
          <Card key={section.field}>
            <CardHeader><CardTitle className="font-heading flex items-center gap-2"><section.icon className="h-5 w-5 text-primary" />{section.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input value={section.value} onChange={(e) => section.setter(e.target.value)}
                  placeholder={`Add ${section.label.toLowerCase()}`}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToList(section.field, section.value, section.setter))} />
                <Button variant="outline" size="icon" onClick={() => addToList(section.field, section.value, section.setter)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {patient[section.field].map((item, i) => (
                  <Badge key={i} variant={section.color as any} className="gap-1 pr-1">
                    {item}
                    <button onClick={() => removeFromList(section.field, i)} className="ml-1 hover:opacity-70"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                {patient[section.field].length === 0 && <p className="text-sm text-muted-foreground">None added yet</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default PatientProfile;
