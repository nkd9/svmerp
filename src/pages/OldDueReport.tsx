import React, { useState, useEffect, useMemo } from 'react';
import { Search, IndianRupee, Download, Printer, AlertCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { academicSessionsMatch, convertLegacySessionLabel } from '../lib/academicSessions';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const formatReceiptDateTime = (date: string) => {
  try {
    return format(new Date(date), 'yyyy-MM-dd, HH:mm:ss');
  } catch {
    return date;
  }
};

export default function OldDueReport() {
  const { user } = useAuth();
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  
  const [oldDueSession, setOldDueSession] = useState('');
  const [oldDueClass, setOldDueClass] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ amount: '' });

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingFee, setPayingFee] = useState<any | null>(null);
  const [payFormData, setPayFormData] = useState({
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    mode: 'Cash',
    reference_no: '',
    discount: '0'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [feesRes, studentsRes, classesRes] = await Promise.all([
      fetch('/api/fees', { headers }),
      fetch('/api/students', { headers }),
      fetch('/api/classes', { headers })
    ]);
    setFees(await feesRes.json());
    setStudents(await studentsRes.json());
    setClasses(await classesRes.json());
  };

  const classNameById = useMemo(
    () => new Map(classes.map((c) => [Number(c.id), String(c.name || '')])),
    [classes]
  );

  const sessionOptions = useMemo(
    () => (Array.from(new Set(students.map((student) => convertLegacySessionLabel(String(student.session || ''))).filter(Boolean))) as string[]).sort((a, b) => b.localeCompare(a)),
    [students]
  );

  const classOptions = useMemo(
    () => (Array.from(new Set(students.map((student) => String(student.class_name || '')).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b)),
    [students]
  );

  const feesWithStudent = useMemo(() => fees.map((fee) => ({
    ...fee,
    student: students.find((student) => student.id === fee.student_id) || null,
  })), [fees, students]);

  const filteredOldDues = useMemo(() => {
    let result = feesWithStudent.filter(fee => {
      if (fee.status !== 'pending') return false;
      if (fee.type === 'Old Due Collection') return true;

      const student = fee.student;
      if (!student) return false;

      const currentSession = student.session;
      const feeSession = fee.academic_session;
      const currentClassId = student.class_id;
      const feeClassId = fee.class_id;

      const isPastDue = 
        (feeSession && currentSession && feeSession !== currentSession) || 
        (feeClassId && currentClassId && Number(feeClassId) !== Number(currentClassId));

      return isPastDue;
    });

    if (oldDueSession) {
      result = result.filter(fee => academicSessionsMatch(String(fee.academic_session || fee.student?.session || ''), oldDueSession));
    }

    if (oldDueClass) {
      result = result.filter(fee => String(classNameById.get(Number(fee.class_id)) || classNameById.get(Number(fee.student?.class_id)) || '') === oldDueClass);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(fee => 
        String(fee.student?.name || '').toLowerCase().includes(q) ||
        String(fee.student?.reg_no || '').toLowerCase().includes(q) ||
        String(fee.bill_no || '').toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => (a.student?.name || '').localeCompare(b.student?.name || ''));
  }, [feesWithStudent, oldDueSession, oldDueClass, searchQuery, classNameById]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin' || !editingFee) {
      alert('Only admin can modify financial information.');
      return;
    }
    
    const res = await fetch(`/api/fees/${editingFee.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ amount: editFormData.amount })
    });
    
    if (res.ok) {
      setIsEditModalOpen(false);
      setEditingFee(null);
      fetchData();
      alert('Fee updated successfully');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update fee');
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin' || !payingFee) {
      alert('Only admin can process payments.');
      return;
    }

    const payload = {
      student_id: String(payingFee.student_id),
      amount: payFormData.amount,
      type: payingFee.type,
      date: payFormData.date,
      status: 'paid',
      discount: payFormData.discount,
      mode: payFormData.mode,
      reference_no: payFormData.reference_no,
      bill_no: payingFee.bill_no || '',
      pending_fee_ids: [payingFee.id]
    };

    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const createdFee = await res.json();
      const printableFee = createdFee.fee || {
        ...payload,
        student_name: payingFee.student?.name || '',
        id: createdFee.id
      };
      handlePrintReceipt(printableFee);
      setIsPayModalOpen(false);
      setPayingFee(null);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to process payment');
    }
  };

  const openEditModal = (fee: any) => {
    setEditingFee(fee);
    setEditFormData({ amount: String(fee.amount) });
    setIsEditModalOpen(true);
  };

  const openPayModal = (fee: any) => {
    setPayingFee(fee);
    setPayFormData({
      amount: String(fee.amount),
      date: format(new Date(), 'yyyy-MM-dd'),
      mode: 'Cash',
      reference_no: '',
      discount: '0'
    });
    setIsPayModalOpen(true);
  };

  const handleDiscountChange = (discountValue: string) => {
    const discount = Number(discountValue || 0);
    const baseAmount = payingFee ? Number(payingFee.amount || 0) : 0;
    const finalAmount = Math.max(baseAmount - discount, 0);
    setPayFormData(prev => ({
      ...prev,
      discount: discountValue,
      amount: String(finalAmount),
    }));
  };

  const handlePrintReceipt = (fee: any) => {
    const student = students.find((item) => item.id === Number(fee.student_id));
    const receiptDate = formatReceiptDateTime(fee.date);
    const particulars = fee.type === 'Fee Collection' ? 'Fee' : fee.type;
    const paidBy = fee.mode || 'Cash';
    const referenceNo = fee.reference_no ? `<div class="footer-note">Reference No.: ${fee.reference_no}</div>` : '';
    const amount = Number(fee.amount || 0);

    const receiptHtml = `
      <div class="receipt">
        <div class="receipt-title">Money Receipt</div>
        <div class="school-name">SVM CLASSES</div>
        <div class="school-meta">Amrit Vihar, Digapahandi (Ganjam)</div>
        <div class="school-meta">Ph:9439326301, www.svmclasses.com</div>

        <div class="row spread">
          <span><strong>Receipt No.:</strong> ${fee.id}</span>
          <span><strong>Date :</strong> ${receiptDate}</span>
        </div>

        <div class="row"><strong>Name :</strong> ${student?.name || fee.student_name || ''}</div>
        <div class="row spread">
          <span><strong>Class.:</strong> ${student?.class_name || ''}</span>
          <span><strong>Student Id :</strong> ${student?.reg_no || ''}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Particulars</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>${particulars}</td>
              <td>${amount}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>Paid By : ${paidBy}</strong></td>
              <td><strong>${amount}/-</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="footer-note">All fees listed above are final and non-refundable once paid</div>
        ${referenceNo}
      </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=700');
    if (!printWindow) {
      alert('Unable to open print window. Please allow pop-ups and try again.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${fee.id}</title>
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #111827; }
            .sheet { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .receipt { border: 1px solid #9ca3af; padding: 8px 10px; }
            .receipt-title { text-align: center; text-decoration: underline; font-size: 13px; margin-bottom: 4px; }
            .school-name { text-align: center; font-size: 24px; font-weight: 700; margin-bottom: 4px; }
            .school-meta { text-align: center; font-size: 13px; margin-bottom: 2px; }
            .row { font-size: 13px; margin-top: 8px; }
            .spread { display: flex; justify-content: space-between; gap: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
            th, td { border: 1px solid #9ca3af; padding: 5px 6px; text-align: left; }
            th:last-child, td:last-child { text-align: right; }
            .footer-note { margin-top: 8px; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${receiptHtml}
            ${receiptHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExport = () => {
    if (!filteredOldDues.length) {
      alert('No data available to export');
      return;
    }

    const rows = filteredOldDues.map((fee) => {
      const studentClass = classNameById.get(Number(fee.class_id)) || classNameById.get(Number(fee.student?.class_id)) || '';
      const academicYear = convertLegacySessionLabel(String(fee.academic_session || fee.student?.session || ''));
      return {
        'Bill No': fee.bill_no,
        'Registration No': fee.student?.reg_no || '',
        'Student Name': fee.student?.name || '',
        'Phone Number': fee.student?.phone || '',
        'Class': studentClass,
        'Educational Year': academicYear,
        'Fee Ledger': fee.type,
        'Due Date': fee.date,
        'Pending Amount': Number(fee.amount || 0)
      };
    });

    const headers = Object.keys(rows[0]);
    const escapeCell = (v: any) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead><tr>${headers.map(h => `<th>${escapeCell(h)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `<tr>${headers.map((h:any) => `<td>${escapeCell((row as any)[h])}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Old_Due_Report.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Old Due Report</h1>
          <p className="text-slate-500">View, edit, and pay old pending dues directly.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-2.5 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
        >
          <Download className="w-4 h-4" />
          Export to Excel
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Educational Year</label>
            <select
              value={oldDueSession}
              onChange={(e) => setOldDueSession(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="">All Educational Years</option>
              {sessionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Class</label>
            <select
              value={oldDueClass}
              onChange={(e) => setOldDueClass(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 focus:border-indigo-500 outline-none"
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student, reg no, or bill no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Bill No</th>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Class / Session</th>
                <th className="px-6 py-4 font-semibold">Fee Ledger</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Due Date</th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 font-semibold text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOldDues.map((fee) => {
                const studentClass = classNameById.get(Number(fee.class_id)) || classNameById.get(Number(fee.student?.class_id)) || '';
                const session = convertLegacySessionLabel(String(fee.academic_session || fee.student?.session || ''));
                
                return (
                  <tr key={fee.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{fee.bill_no}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-semibold text-slate-900">{fee.student?.name}</div>
                      <div className="text-xs text-slate-500">{fee.student?.reg_no}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div>{studentClass}</div>
                      <div className="text-xs text-slate-500">{session}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700 bg-indigo-50/30">
                      {fee.type}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-rose-600">{formatCurrency(Number(fee.amount))}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{fee.date}</td>
                    {user?.role === 'admin' && (
                      <td className="px-6 py-4 text-center space-x-2">
                        <button
                          onClick={() => openEditModal(fee)}
                          className="px-3 py-1.5 hover:bg-slate-100 hover:shadow-sm rounded-lg text-emerald-600 transition-all font-medium text-xs border border-emerald-100 bg-emerald-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPayModal(fee)}
                          className="px-3 py-1.5 hover:bg-indigo-100 hover:shadow-sm rounded-lg text-indigo-700 transition-all font-medium text-xs border border-indigo-200 bg-indigo-50"
                        >
                          Pay
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredOldDues.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 7 : 6} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No pending old dues match your query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Edit Fee Amount</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <Plus className="w-5 h-5 rotate-45 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <h4 className="font-semibold text-slate-700 text-sm">{editingFee?.student?.name}</h4>
                <p className="text-xs text-slate-500">{editingFee?.type} - {editingFee?.bill_no}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Amount</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-bold transition-all shadow-lg shadow-emerald-200"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPayModalOpen && payingFee && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Process Fee Payment</h3>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <Plus className="w-5 h-5 rotate-45 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-5 space-y-5 flex flex-col h-[calc(100vh-8rem)] sm:h-auto max-h-[85vh] overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase">Student</p>
                    <p className="font-bold text-slate-900 mt-0.5">{payingFee.student?.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{payingFee.student?.reg_no}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-semibold uppercase">Fee Details</p>
                    <p className="font-bold text-slate-900 mt-0.5">{payingFee.type}</p>
                    <p className="text-slate-500 font-mono text-xs mt-0.5">{payingFee.bill_no}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 border border-slate-200 rounded-xl p-3 bg-white">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Base Amount</label>
                    <div className="font-bold text-lg text-slate-700">{formatCurrency(Number(payingFee?.amount || 0))}</div>
                  </div>
                  <div className="space-y-1.5 border border-amber-200 bg-amber-50 rounded-xl p-3">
                    <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Discount</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-transparent border-b border-amber-300 py-1 px-0 text-amber-900 font-bold focus:border-amber-600 focus:ring-0"
                      value={payFormData.discount}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5 border-2 border-emerald-500 rounded-xl p-4 bg-emerald-50/50 shadow-sm">
                  <label className="text-sm font-bold text-emerald-800">Final Amount To Pay</label>
                  <div className="relative mt-2">
                    <IndianRupee className="absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-emerald-600" />
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full bg-white border border-emerald-200 rounded-lg py-3 pl-12 pr-4 text-emerald-900 font-black text-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                      value={payFormData.amount}
                      onChange={(e) => setPayFormData({ ...payFormData, amount: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Payment Date</label>
                  <input
                    type="date"
                    required
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={payFormData.date}
                    onChange={(e) => setPayFormData({ ...payFormData, date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Payment Mode</label>
                    <select
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={payFormData.mode}
                      onChange={(e) => setPayFormData({ ...payFormData, mode: e.target.value })}
                    >
                      {['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Reference No.</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={payFormData.reference_no}
                      onChange={(e) => setPayFormData({ ...payFormData, reference_no: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-3 font-bold transition-all shadow-[0_4px_14px_0_rgba(5,150,105,0.39)] hover:shadow-[0_6px_20px_rgba(5,150,105,0.23)] hover:-translate-y-0.5 active:translate-y-0"
                >
                  Pay & Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
