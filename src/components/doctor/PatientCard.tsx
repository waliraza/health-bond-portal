import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, ChevronDown, ChevronUp, FileText, Upload as UploadIcon, Flag, StickyNote, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface PatientCardProps {
  assignment: any;
  isExpanded: boolean;
  records: any[];
  docs: any[];
  onToggle: () => void;
  onToggleFlag: (record: any) => void;
  onOpenNote: (record: any) => void;
  onDownloadDoc: (doc: any) => void;
  onExportCSV: () => void;
  onAddRecord: () => void;
}

const PatientCard = ({
  assignment, isExpanded, records, docs,
  onToggle, onToggleFlag, onOpenNote, onDownloadDoc, onExportCSV, onAddRecord,
}: PatientCardProps) => {
  const profile = assignment.profiles as any;
  const patient = assignment.patients as any;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors" onClick={onToggle}>
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
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-border overflow-hidden">
              <div className="p-4 space-y-4">
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

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onExportCSV}>
                    <Download className="h-3 w-3 mr-1" />Export CSV
                  </Button>
                  <Button size="sm" onClick={onAddRecord}>
                    <FileText className="h-3 w-3 mr-1" />Add Record
                  </Button>
                </div>

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
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onToggleFlag(record)}>
                              <Flag className={`h-3 w-3 ${record.is_flagged ? 'text-destructive fill-destructive' : ''}`} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenNote(record)}>
                              <StickyNote className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {records.length === 0 && <p className="text-xs text-muted-foreground">No records</p>}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Documents ({docs.length})</h4>
                  <div className="space-y-1">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
                        <UploadIcon className="h-4 w-4 text-accent shrink-0" />
                        <span className="text-sm text-foreground flex-1 truncate">{doc.file_name}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(doc.uploaded_at), 'MMM d')}</span>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onDownloadDoc(doc)}>
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
};

export default PatientCard;
