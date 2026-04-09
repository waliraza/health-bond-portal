import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Upload, Calendar, Flag, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

const HealthTimeline = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [r, d] = await Promise.all([
        supabase.from('medical_records').select('*').eq('patient_id', user.id).order('record_date', { ascending: false }),
        supabase.from('documents').select('*').eq('patient_id', user.id).order('uploaded_at', { ascending: false }),
      ]);
      setRecords(r.data || []);
      setDocuments(d.data || []);
    };
    fetchAll();
  }, [user]);

  const timelineItems = [
    ...records.map((r) => ({ ...r, type: 'record', date: r.record_date })),
    ...documents.map((d) => ({ ...d, type: 'document', date: d.uploaded_at?.split('T')[0] || d.uploaded_at })),
  ]
    .filter((item) => {
      const matchSearch = (item.title || item.file_name || '').toLowerCase().includes(search.toLowerCase());
      const matchType = filterType === 'all' || item.type === filterType || (item.type === 'record' && item.record_type === filterType);
      return matchSearch && matchType;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const groupedByMonth: Record<string, typeof timelineItems> = {};
  timelineItems.forEach((item) => {
    const key = format(new Date(item.date), 'MMMM yyyy');
    if (!groupedByMonth[key]) groupedByMonth[key] = [];
    groupedByMonth[key].push(item);
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Health Timeline</h1>
          <p className="text-muted-foreground">Chronological view of your health journey</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search timeline..." className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="record">Records</SelectItem>
              <SelectItem value="document">Documents</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-8">
          {Object.entries(groupedByMonth).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{month}</h2>
              <div className="relative border-l-2 border-border ml-4 space-y-4">
                {items.map((item, i) => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="relative pl-8">
                    <div className={`absolute -left-[9px] top-2 h-4 w-4 rounded-full border-2 border-card ${item.type === 'record' ? 'bg-primary' : 'bg-accent'}`} />
                    <div className="p-4 rounded-xl bg-card border border-border hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {item.type === 'record' ? <FileText className="h-4 w-4 text-primary" /> : <Upload className="h-4 w-4 text-accent" />}
                          <h3 className="font-medium text-foreground text-sm">{item.title || item.file_name}</h3>
                        </div>
                        <div className="flex items-center gap-1">
                          {item.is_flagged && <Flag className="h-3 w-3 text-destructive" />}
                          <Badge variant="outline" className="text-xs">{item.type === 'record' ? item.record_type?.replace('_', ' ') : item.file_type?.split('/')[1]}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Calendar className="h-3 w-3" />{format(new Date(item.date), 'MMM d, yyyy')}
                      </p>
                      {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                      {item.doctor_notes && (
                        <div className="mt-2 p-2 rounded bg-muted text-xs flex items-start gap-1">
                          <StickyNote className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                          <span>{item.doctor_notes}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
          {timelineItems.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No timeline entries yet</p>
              <p className="text-sm">Add medical records or upload documents to see your health timeline</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HealthTimeline;
