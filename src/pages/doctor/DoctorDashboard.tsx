import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, ChevronDown, ChevronUp, FileText, Upload as UploadIcon, Calendar, Flag, StickyNote, Download, Plus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [expandedPatient, setExpandedPatient] = useState<string | null>(null);
  const [patientRecords, setPatientRecords] = useState<Record<string, any[]>>({});
  const [patientDocs, setPatientDocs] = useState<Record<string, any[]>>({});
  const [noteDialog, setNoteDialog] = useState<{ recordId: string; note: string } | null>(null);
  const [addPatientDialog, setAddPatientDialog] = useState(false);
  const [patientEmail, setPatientEmail] = useState('');

  const fetchAssignments = async () => {
    if (!user) return;
    const { data } = await supabase.from('doctor_assignments').select('*, profiles:patient_id(full_name, user_id), patients:patient_id(age, blood_type, allergies, chronic_conditions, current_medications)').eq('doctor_id', user.id);
    setAssignments(data || []);
  };

  useEffect(() => { fetchAssignments(); }, [user]);

  const expandPatient = async (patientId: string) => {
    if (expandedPatient === patientId) { setExpandedPatient(null); return; }
    setExpandedPatient(patientId);
    if (!patientRecords[patientId]) {
      const [r, d] = await Promise.all([
        supabase.from('medical_records').select('*').eq('patient_id', patientId).order('record_date', { ascending: false }),
        supabase.from('documents').select('*').eq('patient_id', patientId).order('uploaded_at', { ascending: false }),
      ]);
      setPatientRecords((prev) => ({ ...prev, [patientId]: r.data || [] }));
      setPatientDocs((prev) => ({ ...prev, [patientId]: d.data || [] }));
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

  const addPatient = async () => {
    if (!user || !patientEmail.trim()) return;
    // Look up user by email via profiles — we need to find the patient user_id
    // Since we can't query auth.users, we search profiles that have patient role
    toast.info('Looking up patient...');
    // For now, we'll use a simple approach - the doctor enters the patient's user ID or email
    // In production, this would be a proper lookup system
    setAddPatientDialog(false);
    setPatientEmail('');
    toast.error('Patient lookup requires admin API. Please add patients through the admin panel.');
  };

  const filtered = assignments.filter((a) => {
    const name = (a.profiles as any)?.full_name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">My Patients</h1>
            <p className="text-muted-foreground">{assignments.length} assigned patient{assignments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients..." className="pl-9" />
        </div>

        <div className="space-y-3">
          {filtered.map((assignment) => {
            const profile = assignment.profiles as any;
            const patient = assignment.patients as any;
            const patientId = assignment.patient_id;
            const isExpanded = expandedPatient === patientId;
            const records = patientRecords[patientId] || [];
            const docs = patientDocs[patientId] || [];

            return (
              <Card key={assignment.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <button className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                    onClick={() => expandPatient(patientId)}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">{profile?.full_name || 'Unknown'}</h3>
                        <div className="flex gap-2 text-xs text-muted-foreground">
                          {patient?.age && <span>Age: {patient.age}</span>}
                          {patient?.blood_type && <Badge variant="outline" className="text-xs">{patient.blood_type}</Badge>}
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border overflow-hidden">
                        <div className="p-4 space-y-4">
                          {/* Patient info */}
                          {patient && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {patient.allergies?.length > 0 && (
                                <div><p className="text-xs text-muted-foreground mb-1">Allergies</p><div className="flex flex-wrap gap-1">{patient.allergies.map((a: string, i: number) => <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>)}</div></div>
                              )}
                              {patient.chronic_conditions?.length > 0 && (
                                <div><p className="text-xs text-muted-foreground mb-1">Conditions</p><div className="flex flex-wrap gap-1">{patient.chronic_conditions.map((c: string, i: number) => <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>)}</div></div>
                              )}
                              {patient.current_medications?.length > 0 && (
                                <div><p className="text-xs text-muted-foreground mb-1">Medications</p><div className="flex flex-wrap gap-1">{patient.current_medications.map((m: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{m}</Badge>)}</div></div>
                              )}
                            </div>
                          )}

                          {/* Export */}
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => exportCSV(patientId, profile?.full_name || 'patient')}>
                              <Download className="h-3 w-3 mr-1" />Export CSV
                            </Button>
                          </div>

                          {/* Records */}
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Medical Records ({records.length})</h4>
                            <div className="space-y-2">
                              {records.map((record) => (
                                <div key={record.id} className="p-3 rounded-lg bg-muted/50 border border-border">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2">
                                      <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-foreground">{record.title}</span>
                                          {record.is_flagged && <Flag className="h-3 w-3 text-destructive fill-destructive" />}
                                          <Badge variant="secondary" className="text-xs">{record.record_type.replace('_', ' ')}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{format(new Date(record.record_date), 'MMM d, yyyy')}</p>
                                        {record.description && <p className="text-xs text-muted-foreground mt-1">{record.description}</p>}
                                        {record.doctor_notes && <div className="mt-1 p-1.5 rounded bg-card text-xs"><StickyNote className="h-3 w-3 inline mr-1 text-primary" />{record.doctor_notes}</div>}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => toggleFlag(record)}>
                                        <Flag className={`h-3 w-3 ${record.is_flagged ? 'text-destructive fill-destructive' : ''}`} />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setNoteDialog({ recordId: record.id, note: record.doctor_notes || '' })}>
                                        <StickyNote className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {records.length === 0 && <p className="text-xs text-muted-foreground">No records</p>}
                            </div>
                          </div>

                          {/* Documents */}
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Documents ({docs.length})</h4>
                            <div className="space-y-1">
                              {docs.map((doc) => (
                                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                                  <UploadIcon className="h-4 w-4 text-accent shrink-0" />
                                  <span className="text-sm text-foreground flex-1 truncate">{doc.file_name}</span>
                                  <span className="text-xs text-muted-foreground">{format(new Date(doc.uploaded_at), 'MMM d')}</span>
                                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownloadDoc(doc)}>
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              {docs.length === 0 && <p className="text-xs text-muted-foreground">No documents</p>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No patients assigned yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Note dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Doctor's Note</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea value={noteDialog?.note || ''} onChange={(e) => setNoteDialog((prev) => prev ? { ...prev, note: e.target.value } : null)} rows={4} placeholder="Add your clinical notes..." />
            <Button onClick={saveNote} className="w-full">Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DoctorDashboard;
