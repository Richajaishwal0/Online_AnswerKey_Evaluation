import React, { useEffect, useState } from 'react';
import { Upload, Loader, KeyRound, FileText, Trash2, Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { teacherAnswerKeyService } from '../services/index.js';

const EMPTY_FORM = { title: '', department: '', subject: '', examName: '', year: '', semester: '', notes: '' };

function Field({ label, name, placeholder, as, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      {as === 'textarea'
        ? <textarea className="input resize-none" rows={2} placeholder={placeholder} value={value} onChange={onChange} />
        : <input className="input" placeholder={placeholder} value={value} onChange={onChange} />
      }
    </div>
  );
}

export default function AnswerKeys() {
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = () => {
    setIsLoading(true);
    teacherAnswerKeyService.list()
      .then(res => setKeys(res.data || []))
      .catch(() => setError('Failed to load answer keys.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!file) { setError('Please select a PDF file.'); return; }
    if (file.type !== 'application/pdf') { setError('Only PDF files are allowed.'); return; }

    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('answerKey', file);
    Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));

    try {
      const res = await teacherAnswerKeyService.upload(fd);
      setKeys(prev => [res.data, ...prev]);
      setForm(EMPTY_FORM);
      setFile(null);
      setShowForm(false);
      setSuccess('Answer key uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this answer key?')) return;
    try {
      await teacherAnswerKeyService.remove(id);
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch {
      setError('Failed to delete.');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">My Answer Keys</h1>
          <p className="page-subtitle">Upload and manage your personal answer key library.</p>
        </div>
        <button className="btn-primary shrink-0 gap-2" onClick={() => { setShowForm(v => !v); setError(''); }}>
          {showForm ? <><X size={15} /> Cancel</> : <><Plus size={15} /> Upload Key</>}
        </button>
      </div>

      {error && <div className="alert-error mb-4 flex items-center gap-2"><AlertCircle size={15} />{error}</div>}
      {success && <div className="alert-success mb-4 flex items-center gap-2"><CheckCircle2 size={15} />{success}</div>}

      {/* Upload Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Answer Key</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Title *" name="title" placeholder="e.g. Mid-Sem CS101 Answer Key" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <Field label="Department" name="department" placeholder="e.g. Computer Science" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            <Field label="Subject" name="subject" placeholder="e.g. Data Structures" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            <Field label="Exam Name" name="examName" placeholder="e.g. Mid Semester Exam" value={form.examName} onChange={e => setForm(f => ({ ...f, examName: e.target.value }))} />
            <Field label="Year" name="year" placeholder="e.g. 2024" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            <Field label="Semester" name="semester" placeholder="e.g. Semester 3" value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))} />
            <div className="sm:col-span-2">
              <Field label="Notes" name="notes" placeholder="Optional notes..." as="textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">PDF File *</label>
              <label className={`flex items-center gap-3 input cursor-pointer py-2.5 px-3.5 ${file ? 'border-indigo-400' : ''}`}>
                <Upload size={15} className="text-gray-400 shrink-0" />
                <span className={`text-sm truncate ${file ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                  {file ? file.name : 'Click to select PDF...'}
                </span>
                <input type="file" accept="application/pdf" className="hidden"
                  onChange={e => { setFile(e.target.files[0] || null); setError(''); }} />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setError(''); setForm(EMPTY_FORM); setFile(null); }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary gap-2" disabled={uploading}>
              {uploading ? <><Loader size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Upload</>}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader className="animate-spin text-indigo-600" size={28} /></div>
      ) : keys.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <KeyRound size={40} className="text-gray-300 dark:text-gray-700 mb-3" />
          <p className="font-semibold text-gray-600 dark:text-gray-400">No answer keys yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Upload your first answer key using the button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(k => (
            <div key={k.id} className="card flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{k.title}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                  {[k.department, k.subject, k.examName, k.year, k.semester].filter(Boolean).join(' · ') || 'No details'}
                </p>
                {k.notes && <p className="text-xs text-gray-400 italic mt-0.5 truncate">{k.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={`http://localhost:5000${k.fileUrl}`} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5">View</a>
                <button onClick={() => handleDelete(k.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
