import React, { useState, useEffect } from 'react';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { getAcademicSessionOptions, getCurrentAcademicSession } from '../lib/academicSessions';
import {
  Button,
  EmptyTableRow,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableToolbar,
} from '../components/ui';

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
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const getPromotableTargetClassName = (className?: string) => {
  const normalized = normalizeAcademicClassName(className || '');
  if (normalized === 'XI ARTS') return 'XII ARTS';
  if (normalized === 'XI SC' || normalized === 'XI SCIENCE') return 'XII SC';
  return '';
};

export default function StudentPromotion() {
  const academicSessionOptions = getAcademicSessionOptions();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromClassId, setFromClassId] = useState('');
  const [targetSession, setTargetSession] = useState(getCurrentAcademicSession());
  const [targetClassId, setTargetClassId] = useState('');
  const [isGraduation, setIsGraduation] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [promotionPreview, setPromotionPreview] = useState<any | null>(null);

  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [stuRes, clsRes] = await Promise.all([
        fetch('/api/students?status=active&view=summary&limit=500', { headers: { Authorization: `Bearer ${token}` } }),
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

      const data = await res.json();

      if (res.ok) {
        if (!isGraduation) {
          const feeMessage = data.warning
            ? `\n\n${data.warning}`
            : `\n\n${data.created_fee_count || 0} 2nd-year pending fee rows created.`;
          alert(`Promotion successful!${feeMessage}`);
        } else {
          alert('Graduation successful!');
        }
        setSelectedStudents([]);
        fetchInitialData();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePreview = async () => {
    if (selectedStudents.length === 0) return alert('Select students to preview.');
    if (isGraduation) return alert('Preview is only needed for promotion fee creation.');
    if (!targetClassId) return alert('Please select a target class.');

    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin/students/promote/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        student_ids: selectedStudents,
        target_class_id: targetClassId,
        target_session: targetSession,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPromotionPreview(data);
    } else {
      alert(data.error || 'Unable to build promotion preview.');
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
      <PageHeader title="Year Promotion & Graduation" description="Promote 1st year students to 2nd year or move passed-out students to alumni." />

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="text-sm font-semibold text-slate-700">Current Year / Class</label>
            <Select value={fromClassId} onChange={e => { setFromClassId(e.target.value); setSelectedStudents([]); }} className="mt-1">
              <option value="">-- All Active Students --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="flex items-end justify-center">
            <ArrowRight className="text-slate-400 mb-2" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Action Type</label>
            <Select value={isGraduation ? 'graduate' : 'promote'} onChange={e => setIsGraduation(e.target.value === 'graduate')} className="mt-1">
              <option value="promote">Promote to Next Year</option>
              <option value="graduate" disabled={!graduationAllowed}>Graduate to Alumni</option>
            </Select>
            {selectedFromClass && !graduationAllowed && (
              <p className="mt-2 text-xs text-slate-500">Only 2nd year classes can be graduated. {selectedFromClass.name} can only be promoted to {allowedTargetClassName}.</p>
            )}
          </div>

          {!isGraduation && (
            <div>
              <label className="text-sm font-semibold text-slate-700">Target Year / Class</label>
              <Select value={targetClassId} onChange={e => setTargetClassId(e.target.value)} className="mt-1">
                <option value="">-- Select Target --</option>
                {promotionTargetOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              {selectedFromClass && !allowedTargetClassName && (
                <p className="mt-2 text-xs text-slate-500">This class does not have an automatic promotion path configured.</p>
              )}
            </div>
          )}

          {!isGraduation && (
            <div>
              <label className="text-sm font-semibold text-slate-700">Target Academic Session</label>
              <Select value={targetSession} onChange={e => setTargetSession(e.target.value)} className="mt-1">
                {academicSessionOptions.map((session) => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <TableContainer className="mt-6">
          <TableToolbar>
            <span className="font-semibold text-slate-700">Select Students ({selectedStudents.length} selected)</span>
            <div className="flex flex-wrap gap-2">
              {!isGraduation && (
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={selectedStudents.length === 0}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  Preview Fees
                </Button>
              )}
              <Button
                onClick={handlePromote}
                disabled={selectedStudents.length === 0}
                className={isGraduation ? 'bg-amber-500 hover:bg-amber-600' : ''}
              >
                <GraduationCap size={18} />
                {isGraduation ? 'Graduate to Alumni' : 'Promote Students'}
              </Button>
            </div>
          </TableToolbar>
          {promotionPreview && !isGraduation && (
            <div className="border-b border-indigo-100 bg-indigo-50 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-4">
                <div><span className="font-semibold">Students:</span> {promotionPreview.totals?.students || 0}</div>
                <div><span className="font-semibold">New 2nd-year fees:</span> {formatCurrency(Number(promotionPreview.totals?.new_fee_amount || 0))}</div>
                <div><span className="font-semibold">Old pending dues:</span> {formatCurrency(Number(promotionPreview.totals?.old_pending_amount || 0))}</div>
                <div><span className="font-semibold">Fee rules:</span> {promotionPreview.structure_count || 0}</div>
              </div>
              {promotionPreview.warning && <p className="mt-2 font-semibold text-amber-700">{promotionPreview.warning}</p>}
              <p className="mt-2 text-slate-600">
                Promotion will create pending 2nd-year dues from the target fee structure and old due payment blocking will still apply.
              </p>
            </div>
          )}
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>
                  <input type="checkbox" onChange={handleSelectAll} checked={eligibleStudents.length > 0 && selectedStudents.length === eligibleStudents.length} className="w-4 h-4 text-indigo-600 rounded" />
                </TableHeaderCell>
                <TableHeaderCell>Student & Reg No</TableHeaderCell>
                <TableHeaderCell>Current Year / Class</TableHeaderCell>
                <TableHeaderCell>Stream</TableHeaderCell>
                <TableHeaderCell>Session</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {eligibleStudents.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => handleSelect(s.id)} className="w-4 h-4 text-indigo-600 rounded" />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{s.name} <span className="ml-2 text-sm text-slate-500">{s.reg_no}</span></TableCell>
                  <TableCell>{s.class_name}</TableCell>
                  <TableCell>{s.stream}</TableCell>
                  <TableCell>{s.session}</TableCell>
                </TableRow>
              ))}
              {eligibleStudents.length === 0 && (
                <EmptyTableRow colSpan={5}>No students found for this class.</EmptyTableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}
