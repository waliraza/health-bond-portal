import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const recordTypes = ['general', 'consultation', 'lab_result', 'prescription', 'surgery', 'vaccination', 'diagnosis'];

interface AddRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  onSave: (data: { title: string; description: string; record_date: string; record_type: string; doctor_notes: string }) => void;
}

const AddRecordDialog = ({ open, onOpenChange, patientName, onSave }: AddRecordDialogProps) => {
  const [form, setForm] = useState({
    title: '',
    description: '',
    record_date: new Date().toISOString().split('T')[0],
    record_type: 'general',
    doctor_notes: '',
  });

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave(form);
    setForm({ title: '', description: '', record_date: new Date().toISOString().split('T')[0], record_type: 'general', doctor_notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Add Record for {patientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Diagnosis - Hypertension" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.record_type} onValueChange={(v) => setForm({ ...form, record_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{recordTypes.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Clinical details..." />
          </div>
          <div className="space-y-2">
            <Label>Doctor's Notes</Label>
            <Textarea value={form.doctor_notes} onChange={(e) => setForm({ ...form, doctor_notes: e.target.value })} rows={2} placeholder="Treatment plan, follow-up instructions..." />
          </div>
          <Button onClick={handleSave} className="w-full" disabled={!form.title.trim()}>Save Record</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddRecordDialog;
