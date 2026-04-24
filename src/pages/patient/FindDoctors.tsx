import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Stethoscope, Send, CheckCircle2, Clock, XCircle, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useRealtime } from '@/hooks/useRealtime';

interface DoctorRow {
  user_id: string;
  specialty: string | null;
  bio: string | null;
  years_experience: number | null;
  available: boolean;
  full_name: string;
}

const FindDoctors = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [requestDialog, setRequestDialog] = useState<DoctorRow | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchAll = async () => {
    if (!user) return;
    const [docRes, profRes, reqRes, assignRes] = await Promise.all([
      supabase.from('doctors').select('*'),
      supabase.from('profiles').select('user_id, full_name'),
      supabase.from('appointment_requests').select('*').eq('patient_id', user.id),
      supabase.from('doctor_assignments').select('*').eq('patient_id', user.id),
    ]);
    const profMap = new Map((profRes.data || []).map((p) => [p.user_id, p.full_name]));
    setDoctors(
      (docRes.data || []).map((d) => ({
        ...d,
        full_name: d.full_name || profMap.get(d.user_id) || 'Doctor',
      }))
    );
    setRequests(reqRes.data || []);
    setAssignments(assignRes.data || []);
  };

  useEffect(() => {
    fetchAll();
  }, [user]);

  useRealtime('appointment_requests', fetchAll, user ? `patient_id=eq.${user.id}` : undefined, !!user);
  useRealtime('doctor_assignments', fetchAll, user ? `patient_id=eq.${user.id}` : undefined, !!user);
  useRealtime('doctors', fetchAll, undefined, !!user);

  const sendRequest = async () => {
    if (!user || !requestDialog) return;
    setSending(true);
    const { error } = await supabase.from('appointment_requests').insert({
      patient_id: user.id,
      doctor_id: requestDialog.user_id,
      message: message || null,
    });
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'You already have a request with this doctor' : 'Failed to send request');
    } else {
      toast.success('Appointment request sent');
      setRequestDialog(null);
      setMessage('');
      fetchAll();
    }
    setSending(false);
  };

  const cancelRequest = async (id: string) => {
    const { error } = await supabase.from('appointment_requests').delete().eq('id', id);
    if (error) toast.error('Failed to cancel');
    else { toast.success('Request cancelled'); fetchAll(); }
  };

  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    return d.full_name.toLowerCase().includes(q) || (d.specialty || '').toLowerCase().includes(q);
  });

  const statusFor = (doctorId: string) => {
    if (assignments.find((a) => a.doctor_id === doctorId)) return 'assigned';
    const req = requests.find((r) => r.doctor_id === doctorId);
    return req?.status; // pending | approved | declined | undefined
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Find a Doctor</h1>
          <p className="text-muted-foreground">Browse doctors and request to be added to their care panel</p>
        </div>

        {requests.filter((r) => r.status === 'pending').length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Pending Requests</h3>
              <div className="space-y-2">
                {requests.filter((r) => r.status === 'pending').map((r) => {
                  const doc = doctors.find((d) => d.user_id === r.doctor_id);
                  return (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">Dr. {doc?.full_name || 'Unknown'} {doc?.specialty && <span className="text-muted-foreground">— {doc.specialty}</span>}</span>
                      <Button size="sm" variant="ghost" onClick={() => cancelRequest(r.id)}>Cancel</Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or specialty..." className="pl-9" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((doc) => {
            const status = statusFor(doc.user_id);
            return (
              <Card key={doc.user_id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Dr. {doc.full_name}</h3>
                      {doc.specialty && <p className="text-sm text-primary">{doc.specialty}</p>}
                      {doc.years_experience != null && <p className="text-xs text-muted-foreground">{doc.years_experience} yrs experience</p>}
                      {doc.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.bio}</p>}
                      <div className="mt-3">
                        {status === 'assigned' ? (
                          <Badge variant="secondary" className="gap-1"><UserCheck className="h-3 w-3" />Your Doctor</Badge>
                        ) : status === 'pending' ? (
                          <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>
                        ) : status === 'declined' ? (
                          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Declined</Badge>
                        ) : status === 'approved' ? (
                          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>
                        ) : (
                          <Button size="sm" variant="outline" disabled={!doc.available} onClick={() => setRequestDialog(doc)}>
                            <Send className="h-3 w-3 mr-1" />Request Appointment
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-12">No doctors found</p>
          )}
        </div>
      </div>

      <Dialog open={!!requestDialog} onOpenChange={(o) => !o && setRequestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Request Appointment with Dr. {requestDialog?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Send a brief message describing your reason for the visit (optional)</p>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="e.g., I'd like a consultation for ongoing back pain..." />
            </div>
            <Button className="w-full" onClick={sendRequest} disabled={sending}>
              {sending ? 'Sending...' : 'Send Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default FindDoctors;
