import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';

interface AssignPatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  assignedPatientIds: string[];
  onAssigned: () => void;
}

const AssignPatientDialog = ({ open, onOpenChange, doctorId, assignedPatientIds, onAssigned }: AssignPatientDialogProps) => {
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fetchPatients = async () => {
      // Fetch all patients with their profiles
      const { data: patients } = await supabase.from('patients').select('user_id, age, blood_type');
      if (!patients) return;

      const userIds = patients.map((p) => p.user_id);
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);

      const merged = patients.map((p) => ({
        ...p,
        full_name: profiles?.find((pr) => pr.user_id === p.user_id)?.full_name || 'Unknown',
      }));
      setAllPatients(merged);
    };
    fetchPatients();
  }, [open]);

  const assignPatient = async (patientUserId: string) => {
    setAssigning(patientUserId);
    const { error } = await supabase.from('doctor_assignments').insert({ doctor_id: doctorId, patient_id: patientUserId });
    if (error) {
      console.error('Assign error:', error);
      toast.error(error.message || 'Failed to assign patient');
    } else {
      toast.success('Patient added to your panel');
      onAssigned();
    }
    setAssigning(null);
  };

  const filtered = allPatients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading">Add Patient</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients..." className="pl-9" />
        </div>
        <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
          {filtered.map((patient) => {
            const isAssigned = assignedPatientIds.includes(patient.user_id);
            return (
              <div key={patient.user_id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium text-sm text-foreground">{patient.full_name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {patient.age && <span>Age: {patient.age}</span>}
                    {patient.blood_type && <Badge variant="outline" className="text-xs">{patient.blood_type}</Badge>}
                  </div>
                </div>
                {isAssigned ? (
                  <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" />Assigned</Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={assigning === patient.user_id} onClick={() => assignPatient(patient.user_id)}>
                    <UserPlus className="h-3 w-3 mr-1" />{assigning === patient.user_id ? 'Adding...' : 'Assign'}
                  </Button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && <p className="text-sm text-center text-muted-foreground py-8">No patients found</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssignPatientDialog;
