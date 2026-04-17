import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Edit2, Check, X } from 'lucide-react';
import { getAcademicSessionOptions, getCurrentAcademicSession } from '../lib/academicSessions';

interface FeeStructure {
  id: number;
  academic_session: string;
  class_id: number;
  stream: string;
  fee_type: string;
  amount: number;
}

interface ClassModel {
  id: number;
  name: string;
}

interface Ledger {
  id: number;
  name: string;
}

const normalizeAcademicClassName = (value?: string) => (value || '').trim().toUpperCase().replace(/\s+/g, ' ');

const deriveStreamFromClassName = (className?: string) => {
  const normalized = normalizeAcademicClassName(className);
  if (normalized.includes('ARTS')) return 'Arts';
  if (normalized.includes('SC') || normalized.includes('SCIENCE')) return 'Science';
  return 'None';
};

const isAcademicCollegeClass = (className?: string) => {
  const normalized = normalizeAcademicClassName(className);
  return /^XI (ARTS|SC|SCIENCE)$/.test(normalized) || /^XII (ARTS|SC|SCIENCE)$/.test(normalized);
};

const formatAcademicYearLabel = (className?: string) => {
  const normalized = normalizeAcademicClassName(className);
  if (normalized.startsWith('XI ')) return '1st Year';
  if (normalized.startsWith('XII ')) return '2nd Year';
  return className || '';
};

const formatStreamLabel = (className?: string) => {
  const stream = deriveStreamFromClassName(className);
  return stream === 'None' ? className || '' : stream;
};

const formatBatchClassLabel = (session: string, className?: string) => {
  const streamLabel = formatStreamLabel(className);
  const yearLabel = formatAcademicYearLabel(className);
  if (!streamLabel || !yearLabel || streamLabel === className || yearLabel === className) {
    return `Batch ${session}${className ? ` • ${className}` : ''}`;
  }

  return `Batch ${session} • ${streamLabel} ${yearLabel}`;
};

export default function FeeStructureSetup() {
  const academicSessionOptions = getAcademicSessionOptions();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [form, setForm] = useState({
    academic_session: getCurrentAcademicSession(),
    class_id: '',
    stream: 'Science',
    fee_type: '',
    amount: ''
  });
  const [applyForm, setApplyForm] = useState({
    academic_session: getCurrentAcademicSession(),
    class_id: '',
    stream: 'Science'
  });
  const feeClassOptions = classes.filter((item) => isAcademicCollegeClass(item.name));
  const selectedFormClass = classes.find((item) => String(item.id) === form.class_id);
  const selectedApplyClass = classes.find((item) => String(item.id) === applyForm.class_id);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [strRes, clsRes, ledgersRes] = await Promise.all([
        fetch('/api/admin/fee-structures', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/fee-ledgers', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (strRes.ok) setStructures(await strRes.json());
      if (clsRes.ok) {
        const classesData = await clsRes.json();
        setClasses(classesData);
        const academicClasses = classesData.filter((item: ClassModel) => isAcademicCollegeClass(item.name));
        if (academicClasses.length > 0) {
          setForm(prev => ({
            ...prev,
            class_id: academicClasses[0].id.toString(),
            stream: deriveStreamFromClassName(academicClasses[0].name)
          }));
          setApplyForm(prev => ({
            ...prev,
            class_id: academicClasses[0].id.toString(),
            stream: deriveStreamFromClassName(academicClasses[0].name)
          }));
        }
      }
      if (ledgersRes.ok) {
        const ledgersData = await ledgersRes.json();
        setLedgers(ledgersData);
        if (ledgersData.length > 0) {
          setForm(prev => ({ ...prev, fee_type: ledgersData[0].name }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.amount) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setForm(prev => ({ ...prev, amount: '' }));
        fetchInitialData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number | string) => {
    if (!confirm('Are you sure you want to delete this fee structure?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/fee-structures/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditSubmit = async (id: number | string) => {
    if (!editAmount) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/admin/fee-structures/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: editAmount })
      });
      if (res.ok) {
        setEditingId(null);
        fetchInitialData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleApply = async () => {
    if (!applyForm.class_id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/fees/apply-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(applyForm)
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Successfully generated/applied fees for ${data.count} student(s) matching this group.`);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Fee Structure Setup</h1>
        <p className="text-slate-500">Set fee rules batch-wise, for example: Batch 2025-2027 • Science 1st Year.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-slate-200 bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold mb-4">Add New Fee Rule</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Batch</label>
              <select value={form.academic_session} onChange={e => setForm({ ...form, academic_session: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required>
                {academicSessionOptions.map((session) => (
                  <option key={session} value={session}>Batch {session}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Year</label>
              <select value={form.class_id} onChange={e => {
                const classItem = classes.find((item) => String(item.id) === e.target.value);
                setForm({ ...form, class_id: e.target.value, stream: deriveStreamFromClassName(classItem?.name) });
              }} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required>
                {feeClassOptions.map(c => <option key={c.id} value={c.id}>{formatStreamLabel(c.name)} {formatAcademicYearLabel(c.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Stream</label>
              <select value={deriveStreamFromClassName(selectedFormClass?.name) !== 'None' ? deriveStreamFromClassName(selectedFormClass?.name) : form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" disabled={deriveStreamFromClassName(selectedFormClass?.name) !== 'None'}>
                <option value="Science">Science</option>
                <option value="Arts">Arts</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">Stream is derived from the selected class.</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Fee Ledger</label>
              <select value={form.fee_type} onChange={e => setForm({ ...form, fee_type: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                {ledgers.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Amount (Rs)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required />
            </div>
            <button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">
              <Plus size={18} /> Add Structure
            </button>
          </form>

          <hr className="my-6 border-slate-100" />
          
          <h2 className="text-lg font-bold mb-4">Bulk Apply Fees</h2>
          <p className="text-xs text-slate-500 mb-4">Select a batch and year to generate pending fee rows for all active students in that group.</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Batch</label>
              <select value={applyForm.academic_session} onChange={e => setApplyForm({ ...applyForm, academic_session: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500">
                {academicSessionOptions.map((session) => (
                  <option key={session} value={session}>Batch {session}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Year</label>
              <select value={applyForm.class_id} onChange={e => {
                const classItem = classes.find((item) => String(item.id) === e.target.value);
                setApplyForm({ ...applyForm, class_id: e.target.value, stream: deriveStreamFromClassName(classItem?.name) });
              }} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500">
                {feeClassOptions.map(c => <option key={c.id} value={c.id}>{formatStreamLabel(c.name)} {formatAcademicYearLabel(c.name)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Stream</label>
              <select value={deriveStreamFromClassName(selectedApplyClass?.name) !== 'None' ? deriveStreamFromClassName(selectedApplyClass?.name) : applyForm.stream} onChange={e => setApplyForm({ ...applyForm, stream: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" disabled={deriveStreamFromClassName(selectedApplyClass?.name) !== 'None'}>
                <option value="Science">Science</option>
                <option value="Arts">Arts</option>
              </select>
            </div>
            <button onClick={handleApply} className="w-full flex justify-center items-center gap-2 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">
              <CheckCircle size={18} /> Apply to Active Students
            </button>
          </div>
        </div>

        <div className="md:col-span-2 flex flex-col gap-6">
          {(() => {
            const groupedStructures = structures.reduce((acc, struct) => {
              const key = `${struct.academic_session}_${struct.class_id}_${struct.stream}`;
              if (!acc[key]) {
                acc[key] = {
                  academic_session: struct.academic_session,
                  class_id: struct.class_id,
                  stream: struct.stream,
                  fees: []
                };
              }
              acc[key].fees.push(struct);
              return acc;
            }, {} as Record<string, { academic_session: string; class_id: number; stream: string; fees: FeeStructure[] }>);

            const groupKeys = Object.keys(groupedStructures);

            if (groupKeys.length === 0) {
              return (
                <div className="border border-slate-200 bg-white p-8 rounded-2xl shadow-sm text-center text-slate-500 flex flex-col items-center justify-center min-h-[300px]">
                  <p className="text-lg font-medium text-slate-900 mb-2">No Fee Rules Yet</p>
                  <p className="text-sm">Use the form to configure fee ledgers for a batch and class.</p>
                </div>
              );
            }

            return groupKeys.map(key => {
              const group = groupedStructures[key];
              const cName = classes.find(c => c.id === group.class_id)?.name || group.class_id;
              const totalAmount = group.fees.reduce((sum, f) => sum + Number(f.amount), 0);
              
              return (
                <div key={key} className="border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="bg-slate-50 border-b border-slate-100 px-6 py-5 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {formatBatchClassLabel(group.academic_session, String(cName))}
                      </h3>
                      <p className="text-sm text-slate-500 font-medium">{group.stream} Stream</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Bundle</span>
                      <p className="text-xl font-bold tracking-tight text-indigo-600">Rs {totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <ul className="divide-y divide-slate-100">
                      {group.fees.map(fee => (
                        <li key={fee.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 rounded-xl group/item transition-colors">
                          <div className="font-medium text-slate-700 flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                            {fee.fee_type}
                          </div>
                          <div className="flex items-center gap-4">
                            {editingId === fee.id ? (
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number" 
                                  value={editAmount} 
                                  onChange={(e) => setEditAmount(e.target.value)} 
                                  className="w-24 px-2 py-1 text-sm font-semibold border-2 border-indigo-200 rounded focus:outline-none focus:border-indigo-500 bg-white"
                                  autoFocus
                                />
                                <button onClick={() => handleEditSubmit(fee.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Save">
                                  <Check size={18} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded transition-colors" title="Cancel">
                                  <X size={18} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-slate-900 w-24 text-right">Rs {Number(fee.amount).toLocaleString('en-IN')}</span>
                                <div className="flex opacity-0 group-hover/item:opacity-100 transition-opacity gap-1">
                                  <button 
                                    onClick={() => {
                                      setEditingId(fee.id);
                                      setEditAmount(String(fee.amount));
                                    }} 
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all shadow-sm hover:shadow" title="Edit Ledger">
                                    <Edit2 size={15} />
                                  </button>
                                  <button onClick={() => handleDelete(fee.id)} className="p-1.5 text-slate-400 hover:text-white hover:bg-rose-500 rounded-md transition-all shadow-sm hover:shadow" title="Delete Ledger">
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
