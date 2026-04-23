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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, FileText, Edit, Trash2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useRealtime } from '@/hooks/useRealtime';

const recordTypes = ['general', 'consultation', 'lab_result', 'prescription', 'surgery', 'vaccination', 'diagnosis'];

const MedicalRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', record_date: new Date().toISOString().split('T')[0], record_type: 'general' });

  const fetchRecords = async () => {
    if (!user) return;
    const { data } = await supabase.from('medical_records').select('*').eq('patient_id', user.id).order('record_date', { ascending: false });
    setRecords(data || []);
  };

  useEffect(() => { fetchRecords(); }, [user]);

  useRealtime('medical_records', fetchRecords, user ? `patient_id=eq.${user.id}` : undefined, !!user);

  const handleSave = async () => {
    if (!user || !form.title.trim()) { toast.error('Title is required'); return; }
    if (editing) {
      await supabase.from('medical_records').update(form).eq('id', editing.id);
      toast.success('Record updated');
    } else {
      await supabase.from('medical_records').insert({ ...form, patient_id: user.id });
      toast.success('Record created');
    }
    setDialogOpen(false);
    setEditing(null);
    setForm({ title: '', description: '', record_date: new Date().toISOString().split('T')[0], record_type: 'general' });
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('medical_records').delete().eq('id', id);
    toast.success('Record deleted');
    fetchRecords();
  };

  const openEdit = (record: any) => {
    setEditing(record);
    setForm({ title: record.title, description: record.description || '', record_date: record.record_date, record_type: record.record_type });
    setDialogOpen(true);
  };

  const filtered = records.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || r.record_type === filterType;
    return matchSearch && matchType;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Medical Records</h1>
            <p className="text-muted-foreground">{records.length} record{records.length !== 1 ? 's' : ''}</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ title: '', description: '', record_date: new Date().toISOString().split('T')[0], record_type: 'general' }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Record</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">{editing ? 'Edit' : 'New'} Medical Record</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Annual checkup" />
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
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Details about this record..." />
                </div>
                <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Create'} Record</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records..." className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {recordTypes.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((record) => (
              <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground truncate">{record.title}</h3>
                          {record.is_flagged && <Badge variant="destructive" className="text-xs">Flagged</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(record.record_date), 'MMM d, yyyy')}
                          <Badge variant="secondary" className="text-xs">{record.record_type.replace('_', ' ')}</Badge>
                        </div>
                        {record.description && <p className="text-sm text-muted-foreground line-clamp-2">{record.description}</p>}
                        {record.doctor_notes && (
                          <div className="mt-2 p-2 rounded bg-muted text-sm">
                            <span className="font-medium text-foreground">Doctor's Note:</span> {record.doctor_notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(record)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No records found</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MedicalRecords;
