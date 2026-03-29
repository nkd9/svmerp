import React, { useState, useEffect } from 'react';
import { ArrowRight, GraduationCap } from 'lucide-react';

interface Student {
  id: number;
  name: string;
  reg_no: string;
  class_id: number;
  class_name?: string;
  stream: string;
  session: string;
}

interface ClassModel {
  id: number;
  name: string;
}

const normalizeAcademicClassName = (value: string) => value.trim().toUpperCase().replace(/\s+/g, ' ');

const getPromotableTargetClassName = (className?: string) => {
  const normalized = normalizeAcademicClassName(className || '');
  if (normalized === 'XI ARTS') return 'XII ARTS';
  if (normalized === 'XI SC' || normalized === 'XI SCIENCE') return 'XII SC';
  return '';
};

export default function StudentPromotion() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromClassId, setFromClassId] = useState('');
  const [targetSession, setTargetSession] = useState('2025-2026');
  const [targetClassId, setTargetClassId] = useState('');
  const [isGraduation, setIsGraduation] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [stuRes, clsRes] = await Promise.all([
        fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (clsRes.ok) {
        setClasses(await clsRes.json());
      }
      if (stuRes.ok) {
        setStudents(await stuRes.json());
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

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(eligibleStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePromote = async () => {
    if (selectedStudents.length === 0) return alert('Select students to promote.');
    if (!isGraduation && !targetClassId) return alert('Please select a target class.');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/students/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          student_ids: selectedStudents,
          target_class_id: targetClassId,
          target_session: targetSession,
          is_graduation: isGraduation
        })
      });

      if (res.ok) {
        alert('Action successful!');
        setSelectedStudents([]);
        fetchInitialData();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  const eligibleStudents = students.filter(s => (fromClassId ? s.class_id.toString() === fromClassId : true) && s.status !== 'alumni');
  const selectedFromClass = classes.find((item) => String(item.id) === fromClassId);
  const allowedTargetClassName = getPromotableTargetClassName(selectedFromClass?.name);
  const promotionTargetOptions = allowedTargetClassName
    ? classes.filter((item) => normalizeAcademicClassName(item.name) === normalizeAcademicClassName(allowedTargetClassName))
    : [];
  const graduationAllowed = selectedFromClass ? !allowedTargetClassName : true;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Year Promotion & Graduation</h1>
        <p className="text-slate-500">Promote 1st year students to 2nd year or move passed-out students to alumni.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="text-sm font-semibold text-slate-700">Current Year / Class</label>
            <select value={fromClassId} onChange={e => { setFromClassId(e.target.value); setSelectedStudents([]); }} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">-- All Active Students --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end justify-center">
            <ArrowRight className="text-slate-400 mb-2" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Action Type</label>
            <select value={isGraduation ? 'graduate' : 'promote'} onChange={e => setIsGraduation(e.target.value === 'graduate')} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="promote">Promote to Next Year</option>
              <option value="graduate" disabled={!graduationAllowed}>Graduate to Alumni</option>
            </select>
            {selectedFromClass && !graduationAllowed && (
              <p className="mt-2 text-xs text-slate-500">Only 2nd year classes can be graduated. {selectedFromClass.name} can only be promoted to {allowedTargetClassName}.</p>
            )}
          </div>

          {!isGraduation && (
            <div>
              <label className="text-sm font-semibold text-slate-700">Target Year / Class</label>
              <select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">-- Select Target --</option>
                {promotionTargetOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedFromClass && !allowedTargetClassName && (
                <p className="mt-2 text-xs text-slate-500">This class does not have an automatic promotion path configured.</p>
              )}
            </div>
          )}

          {!isGraduation && (
            <div>
              <label className="text-sm font-semibold text-slate-700">Target Academic Session</label>
              <select value={targetSession} onChange={e => setTargetSession(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="2023-2024">2023-2024</option>
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
                <option value="2027-2028">2027-2028</option>
                <option value="2028-2029">2028-2029</option>
              </select>
            </div>
          )}
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden mt-6">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Select Students ({selectedStudents.length} selected)</span>
            <button
              onClick={handlePromote}
              disabled={selectedStudents.length === 0}
              className={`px-6 py-2 rounded-lg font-bold text-white transition-colors flex items-center gap-2 ${selectedStudents.length > 0 ? (isGraduation ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700') : 'bg-slate-300 cursor-not-allowed'}`}
            >
              <GraduationCap size={18} />
              {isGraduation ? 'Graduate to Alumni' : 'Promote Students'}
            </button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-3">
                  <input type="checkbox" onChange={handleSelectAll} checked={eligibleStudents.length > 0 && selectedStudents.length === eligibleStudents.length} className="w-4 h-4 text-indigo-600 rounded" />
                </th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student & Reg No</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Year / Class</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stream</th>
                <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {eligibleStudents.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => handleSelect(s.id)} className="w-4 h-4 text-indigo-600 rounded" />
                  </td>
                  <td className="px-6 py-3 font-medium text-slate-900">{s.name} <span className="text-slate-500 text-sm ml-2">{s.reg_no}</span></td>
                  <td className="px-6 py-3 text-slate-700">{s.class_name}</td>
                  <td className="px-6 py-3 text-slate-700">{s.stream}</td>
                  <td className="px-6 py-3 text-slate-700">{s.session}</td>
                </tr>
              ))}
              {eligibleStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No students found for this class.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
