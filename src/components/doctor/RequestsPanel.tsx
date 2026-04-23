import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Mail, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRealtime } from '@/hooks/useRealtime';

interface RequestsPanelProps {
  doctorId: string;
  onApproved: () => void;
}

const RequestsPanel = ({ doctorId, onApproved }: RequestsPanelProps) => {
  const [requests, setRequests] = useState<any[]>([]);

  const fetch = async () => {
    const { data: reqs } = await supabase
      .from('appointment_requests')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqs || reqs.length === 0) {
      setRequests([]);
      return;
    }

    const patientIds = reqs.map((r) => r.patient_id);
    const [profiles, patients] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').in('user_id', patientIds),
      supabase.from('patients').select('user_id, age, blood_type').in('user_id', patientIds),
    ]);
    const profMap = new Map((profiles.data || []).map((p) => [p.user_id, p.full_name]));
    const patMap = new Map((patients.data || []).map((p) => [p.user_id, p]));

    setRequests(
      reqs.map((r) => ({
        ...r,
        full_name: profMap.get(r.patient_id) || 'Unknown',
        patient: patMap.get(r.patient_id),
      }))
    );
  };

  useEffect(() => { fetch(); }, [doctorId]);

  useRealtime('appointment_requests', fetch, `doctor_id=eq.${doctorId}`);

  const respond = async (id: string, status: 'approved' | 'declined') => {
    const { error } = await supabase.from('appointment_requests').update({ status }).eq('id', id);
    if (error) {
      toast.error('Failed to update request');
      return;
    }
    toast.success(status === 'approved' ? 'Patient added to your panel' : 'Request declined');
    fetch();
    if (status === 'approved') onApproved();
  };

  if (requests.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Appointment Requests
          <Badge variant="secondary">{requests.length}</Badge>
        </h3>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm text-foreground">{r.full_name}</p>
                  {r.patient?.age && <span className="text-xs text-muted-foreground">Age {r.patient.age}</span>}
                  {r.patient?.blood_type && <Badge variant="outline" className="text-xs">{r.patient.blood_type}</Badge>}
                </div>
                {r.message && <p className="text-xs text-muted-foreground mt-1 italic">"{r.message}"</p>}
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />{format(new Date(r.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => respond(r.id, 'declined')}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" onClick={() => respond(r.id, 'approved')}>
                  <Check className="h-3 w-3 mr-1" />Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RequestsPanel;
