import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SubjectMaster() {
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '', class_id: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
    const [classesRes, subjectsRes] = await Promise.all([
      fetch('/api/classes', { headers }),
      fetch('/api/subjects', { headers }),
    ]);

    setClasses(await classesRes.json());
    setSubjects(await subjectsRes.json());
  };

  const groupedSubjects = useMemo(
    () =>
      classes.map((classItem) => ({
        ...classItem,
        subjects: subjects.filter((subject) => subject.class_id === classItem.id),
      })),
    [classes, subjects],
  );

  const openCreateModal = () => {
    setEditingSubject(null);
    setFormData({ name: '', class_id: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (subject: any) => {
    setEditingSubject(subject);
    setFormData({ name: subject.name, class_id: String(subject.class_id) });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingSubject ? 'PUT' : 'POST';
    const url = editingSubject ? `/api/subjects/${editingSubject.id}` : '/api/subjects';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      setIsModalOpen(false);
      setEditingSubject(null);
      setFormData({ name: '', class_id: '' });
      fetchData();
    }
  };

  const handleDelete = async (subject: any) => {
    const confirmed = window.confirm(`Delete subject "${subject.name}"? Related marks for this subject will also be removed.`);
    if (!confirmed) {
      return;
    }

    const res = await fetch(`/api/subjects/${subject.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });

    if (res.ok) {
      fetchData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subject Master</h1>
          <p className="text-slate-500">Manage subjects class wise with create, edit, and delete actions.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/exams"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Exams
          </Link>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
          >
            <Plus className="h-5 w-5" />
            Add Subject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {groupedSubjects.map((classItem) => (
          <section key={classItem.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{classItem.name}</h2>
                <p className="text-sm text-slate-500">
                  {classItem.subjects.length} subject{classItem.subjects.length === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="p-6">
              {classItem.subjects.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                  No subjects added for this class yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {classItem.subjects.map((subject: any) => (
                    <div key={subject.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{subject.name}</p>
                        <p className="text-sm text-slate-500">{classItem.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(subject)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(subject)}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h3 className="text-xl font-bold text-slate-900">{editingSubject ? 'Edit Subject' : 'Create Subject'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-full p-2 transition-colors hover:bg-slate-100">
                <X className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Subject Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Class</label>
                <select
                  required
                  value={formData.class_id}
                  onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.id} value={classItem.id}>{classItem.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
              >
                {editingSubject ? 'Save Changes' : 'Create Subject'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
