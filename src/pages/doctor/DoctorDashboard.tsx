import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import PatientCard from '@/components/doctor/PatientCard';
import AddRecordDialog from '@/components/doctor/AddRecordDialog';
import AssignPatientDialog from '@/components/doctor/AssignPatientDialog';
import RequestsPanel from '@/components/doctor/RequestsPanel';
import { useRealtime } from '@/hooks/useRealtime';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [patientRecords, setPatientRecords] = useState<Record<string, any[]>>({});
  const [patientDocs, setPatientDocs] = useState<Record<string, any[]>>({});
  const [noteDialog, setNoteDialog] = useState<{ recordId: string; note: string } | null>(null);
  const [assignDialog, setAssignDialog] = useState(false);
  const [addRecordFor, setAddRecordFor] = useState<{ patientId: string; name: string } | null>(null);

  const fetchAssignments = async () => {
    if (!user) return;
    const { data: assigns } = await supabase
      .from('doctor_assignments')
      .select('*')
      .eq('doctor_id', user.id);
    if (!assigns || assigns.length === 0) {
      setAssignments([]);
      return;
    }
    const patientIds = assigns.map((a) => a.patient_id);
    const [profiles, patients] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', patientIds),
      supabase.from('patients').select('user_id, age, blood_type, allergies, chronic_conditions, current_medications').in('user_id', patientIds),
    ]);
    const profMap = new Map((profiles.data || []).map((p) => [p.user_id, p]));
    const patMap = new Map((patients.data || []).map((p) => [p.user_id, p]));
    setAssignments(
      assigns.map((a) => ({
        ...a,
        profiles: profMap.get(a.patient_id) || { full_name: 'Unknown' },
        patients: patMap.get(a.patient_id) || null,
      }))
    );
  };

  useEffect(() => { fetchAssignments(); }, [user]);

  // Realtime: refresh assignments and any expanded patient's records/docs
  useRealtime('doctor_assignments', fetchAssignments, user ? `doctor_id=eq.${user.id}` : undefined, !!user);
  useRealtime('medical_records', () => {
    if (expandedPatient) refreshPatientData(expandedPatient);
  }, undefined, !!user);
  useRealtime('documents', () => {
    if (expandedPatient) refreshPatientData(expandedPatient);
  }, undefined, !!user);

  const refreshPatientData = async (patientId: string) => {
    const [r, d] = await Promise.all([
      supabase.from('medical_records').select('*').eq('patient_id', patientId).order('record_date', { ascending: false }),
      supabase.from('documents').select('*').eq('patient_id', patientId).order('uploaded_at', { ascending: false }),
    ]);
    setPatientRecords((prev) => ({ ...prev, [patientId]: r.data || [] }));
    setPatientDocs((prev) => ({ ...prev, [patientId]: d.data || [] }));
  };

  const expandPatient = async (patientId: string) => {
    if (expandedPatient === patientId) { setExpandedPatient(null); return; }
    setExpandedPatient(patientId);
    if (!patientRecords[patientId]) {
      await refreshPatientData(patientId);
    }
  };

  const toggleFlag = async (record: any) => {
    await supabase.from('medical_records').update({ is_flagged: !record.is_flagged }).eq('id', record.id);
    setPatientRecords((prev) => ({
      ...prev,
      [record.patient_id]: prev[record.patient_id].map((r) => r.id === record.id ? { ...r, is_flagged: !r.is_flagged } : r),
    }));
    toast.success(record.is_flagged ? 'Flag removed' : 'Record flagged');
  };

  const saveNote = async () => {
    if (!noteDialog) return;
    await supabase.from('medical_records').update({ doctor_notes: noteDialog.note }).eq('id', noteDialog.recordId);
    const record = Object.values(patientRecords).flat().find((r) => r.id === noteDialog.recordId);
    if (record) {
      setPatientRecords((prev) => ({
        ...prev,
        [record.patient_id]: prev[record.patient_id].map((r) => r.id === noteDialog.recordId ? { ...r, doctor_notes: noteDialog.note } : r),
      }));
    }
    setNoteDialog(null);
    toast.success('Note saved');
  };

  const handleDownloadDoc = async (doc: any) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const exportCSV = (patientId: string, name: string) => {
    const records = patientRecords[patientId] || [];
    const csv = ['Title,Date,Type,Description,Doctor Notes,Flagged', ...records.map((r) =>
      `"${r.title}","${r.record_date}","${r.record_type}","${(r.description || '').replace(/"/g, '""')}","${(r.doctor_notes || '').replace(/"/g, '""')}","${r.is_flagged}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}_records.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddRecord = async (patientId: string, data: any) => {
    const { error } = await supabase.from('medical_records').insert({
      patient_id: patientId,
      title: data.title,
      description: data.description || null,
      record_date: data.record_date,
      record_type: data.record_type,
      doctor_notes: data.doctor_notes || null,
    });
    if (error) {
      toast.error('Failed to add record');
      return;
    }
    toast.success('Record added — patient will see it instantly');
    await refreshPatientData(patientId);
    setAddRecordFor(null);
  };

  const filtered = assignments.filter((a) => {
    const name = (a.profiles as any)?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const assignedPatientIds = assignments.map((a) => a.patient_id);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">My Patients</h1>
            <p className="text-muted-foreground">{assignments.length} assigned patient{assignments.length !== 1 ? 's' : ''}</p>
          </div>
          <Button onClick={() => setAssignDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />Add Patient
          </Button>
        </div>

        {user && <RequestsPanel doctorId={user.id} onApproved={fetchAssignments} />}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients..." className="pl-9" />
        </div>

        <div className="space-y-3">
          {filtered.map((assignment) => {
            const patientId = assignment.patient_id;
            return (
              <PatientCard
                key={assignment.id}
                assignment={assignment}
                isExpanded={expandedPatient === patientId}
                records={patientRecords[patientId] || []}
                docs={patientDocs[patientId] || []}
                onToggle={() => expandPatient(patientId)}
                onToggleFlag={toggleFlag}
                onOpenNote={(record) => setNoteDialog({ recordId: record.id, note: record.doctor_notes || '' })}
                onDownloadDoc={handleDownloadDoc}
                onExportCSV={() => exportCSV(patientId, (assignment.profiles as any)?.full_name || 'patient')}
                onAddRecord={() => setAddRecordFor({ patientId, name: (assignment.profiles as any)?.full_name || 'Patient' })}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No patients assigned yet</p>
              <p className="text-xs mt-1">Patients can request appointments, or you can add them directly.</p>
              <Button variant="outline" className="mt-4" onClick={() => setAssignDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />Add Your First Patient
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Doctor's Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={noteDialog?.note || ''} onChange={(e) => setNoteDialog((prev) => prev ? { ...prev, note: e.target.value } : null)} rows={4} placeholder="Add your clinical notes..." />
            <Button onClick={saveNote} className="w-full">Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>

      {user && (
        <AssignPatientDialog
          open={assignDialog}
          onOpenChange={setAssignDialog}
          doctorId={user.id}
          assignedPatientIds={assignedPatientIds}
          onAssigned={() => { fetchAssignments(); setAssignDialog(false); }}
        />
      )}

      <AddRecordDialog
        open={!!addRecordFor}
        onOpenChange={(o) => !o && setAddRecordFor(null)}
        patientName={addRecordFor?.name || ''}
        onSave={(data) => addRecordFor && handleAddRecord(addRecordFor.patientId, data)}
      />
    </DashboardLayout>
  );
};

export default DoctorDashboard;
