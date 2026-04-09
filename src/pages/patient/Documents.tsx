import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Search, FileText, Image, File, Trash2, Download, CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const maxSize = 10 * 1024 * 1024; // 10MB

const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async () => {
    if (!user) return;
    const { data } = await supabase.from('documents').select('*').eq('patient_id', user.id).order('uploaded_at', { ascending: false });
    setDocuments(data || []);
  };

  useEffect(() => { fetchDocuments(); }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Allowed: PDF, JPG, PNG, WEBP, DOC, DOCX`);
        continue;
      }
      if (file.size > maxSize) {
        toast.error(`${file.name}: File too large. Max 10MB`);
        continue;
      }

      setUploading(true);
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('medical-documents').upload(filePath, file);

      if (uploadError) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      await supabase.from('documents').insert({
        patient_id: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
      });
      toast.success(`${file.name} uploaded`);
    }
    setUploading(false);
    fetchDocuments();
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDelete = async (doc: any) => {
    await supabase.storage.from('medical-documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    toast.success('Document deleted');
    fetchDocuments();
  };

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from('medical-documents').createSignedUrl(doc.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type.includes('pdf')) return FileText;
    return File;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filtered = documents.filter((d) => {
    const matchSearch = d.file_name.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || d.file_type.includes(filterType);
    return matchSearch && matchType;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Documents</h1>
            <p className="text-muted-foreground">{documents.length} file{documents.length !== 1 ? 's' : ''} uploaded</p>
          </div>
          <div>
            <input ref={fileRef} type="file" multiple accept={allowedTypes.join(',')} className="hidden" onChange={handleUpload} />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              <CloudUpload className="h-4 w-4 mr-2" />{uploading ? 'Uploading...' : 'Upload Files'}
            </Button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (fileRef.current && e.dataTransfer.files.length) {
              const dt = new DataTransfer();
              Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
              fileRef.current.files = dt.files;
              fileRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drag & drop files here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, WEBP, DOC, DOCX · Max 10MB</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..." className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="image">Images</SelectItem>
              <SelectItem value="word">Documents</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((doc) => {
              const Icon = getIcon(doc.file_type);
              return (
                <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0"><Icon className="h-5 w-5 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate text-sm">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(doc.file_size)} · {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No documents yet</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Documents;
