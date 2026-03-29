import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';

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

export default function FeeStructureSetup() {
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    academic_session: '2025-2026',
    class_id: '',
    stream: 'Science',
    fee_type: '',
    amount: ''
  });
  const [applyForm, setApplyForm] = useState({
    academic_session: '2025-2026',
    class_id: '',
    stream: 'Science'
  });

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
        if (classesData.length > 0) {
          setForm(prev => ({ ...prev, class_id: classesData[0].id.toString() }));
          setApplyForm(prev => ({ ...prev, class_id: classesData[0].id.toString() }));
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

  const handleDelete = async (id: number) => {
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
        <p className="text-slate-500">Configure global fees by academic year, class, and stream.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border border-slate-200 bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-lg font-bold mb-4">Add New Fee Rule</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Academic Session</label>
              <select value={form.academic_session} onChange={e => setForm({ ...form, academic_session: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required>
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
                <option value="2028-2029">2028-2029</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Class (Year)</label>
              <select value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" required>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Stream</label>
              <select value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="Science">Science</option>
                <option value="Arts">Arts</option>
                <option value="Commerce">Commerce</option>
                <option value="None">None</option>
              </select>
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
          <p className="text-xs text-slate-500 mb-4">Select a specific session, class, and stream to automatically generate pending fee invoices for all active students in that group.</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Session</label>
              <select value={applyForm.academic_session} onChange={e => setApplyForm({ ...applyForm, academic_session: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
                <option value="2028-2029">2028-2029</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Class</label>
              <select value={applyForm.class_id} onChange={e => setApplyForm({ ...applyForm, class_id: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500">
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Stream</label>
              <select value={applyForm.stream} onChange={e => setApplyForm({ ...applyForm, stream: e.target.value })} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="Science">Science</option>
                <option value="Arts">Arts</option>
                <option value="Commerce">Commerce</option>
                <option value="None">None</option>
              </select>
            </div>
            <button onClick={handleApply} className="w-full flex justify-center items-center gap-2 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">
              <CheckCircle size={18} /> Apply To Students
            </button>
          </div>
        </div>

        <div className="md:col-span-2 border border-slate-200 bg-white overflow-hidden rounded-2xl shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500">Session</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500">Class</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500">Stream</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500">Fee Ledger</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {structures.map(struct => {
                const cName = classes.find(c => c.id === struct.class_id)?.name || struct.class_id;
                return (
                  <tr key={struct.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{struct.academic_session}</td>
                    <td className="px-6 py-4 text-slate-700">{cName}</td>
                    <td className="px-6 py-4 text-slate-700">{struct.stream}</td>
                    <td className="px-6 py-4 text-slate-700">{struct.fee_type}</td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">Rs {struct.amount}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleDelete(struct.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {structures.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No fee structures configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
