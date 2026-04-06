import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, IndianRupee, Download, ArrowRight, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const formatReceiptDateTime = (date: string) => {
  try {
    return format(new Date(date), 'yyyy-MM-dd, HH:mm:ss');
  } catch {
    return date;
  }
};

export default function Fees() {
  const { user } = useAuth();
  console.log("DEBUG: Current User Data ->", user);

  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileStudent, setProfileStudent] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ amount: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedPendingFeeId, setSelectedPendingFeeId] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    type: 'Admission Fee',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'paid',
    discount: '0',
    mode: 'Cash',
    reference_no: '',
    bill_no: `BILL-${Date.now()}`
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [feesRes, studentsRes, ledgersRes] = await Promise.all([
      fetch('/api/fees', { headers }),
      fetch('/api/students', { headers }),
      fetch('/api/fee-ledgers', { headers })
    ]);
    setFees(await feesRes.json());
    setStudents(await studentsRes.json());
    if (ledgersRes.ok) {
      const ledgersData = await ledgersRes.json();
      setLedgers(ledgersData);
      if (ledgersData.length > 0) {
        setFormData(prev => ({ ...prev, type: ledgersData[0].name }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin') {
      alert('Only admin can modify financial information.');
      return;
    }
    const selectedPendingFee = fees.find((fee) => String(fee.id) === selectedPendingFeeId) || null;
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ...formData,
        pending_fee_ids: selectedPendingFee ? [selectedPendingFee.id] : [],
      })
    });
    if (res.ok) {
      const createdFee = await res.json();
      const printableFee = createdFee.fee || {
        id: createdFee.id,
        student_id: Number(formData.student_id),
        student_name: selectedStudent?.name || '',
        amount: Number(formData.amount),
        type: formData.type,
        date: formData.date,
        status: formData.status,
        mode: formData.mode,
        reference_no: formData.reference_no,
        bill_no: formData.bill_no,
      };

      handlePrintReceipt(printableFee);
      setIsModalOpen(false);
      fetchData();
      setStudentSearch('');
      setSelectedPendingFeeId('');
      setFormData({
        student_id: '', amount: '', type: ledgers[0]?.name || 'Admission Fee',
        date: format(new Date(), 'yyyy-MM-dd'), status: 'paid',
        discount: '0', mode: 'Cash', reference_no: '',
        bill_no: `BILL-${Date.now()}`
      });
    } else {
      const errorData = await res.json();
      alert(errorData.error || 'Check failed. Payment could not be processed.');
    }
  };

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

  const openEditModal = (fee: any) => {
    setEditingFee(fee);
    setEditFormData({ amount: String(fee.amount) });
    setIsEditModalOpen(true);
  };

  const filteredFees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return fees;
    }

    return fees.filter((fee) =>
      String(fee.bill_no || '').toLowerCase().includes(query) ||
      String(fee.student_name || '').toLowerCase().includes(query) ||
      String(fee.type || '').toLowerCase().includes(query) ||
      String(fee.status || '').toLowerCase().includes(query),
    );
  }, [fees, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredFees.length / pageSize);
  const paginatedFees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFees.slice(start, start + pageSize);
  }, [filteredFees, currentPage]);

  const now = new Date();
  const totalCollected = fees
    .filter((fee) => {
      if (fee.status !== 'paid') return false;
      const feeDate = new Date(fee.date);
      return feeDate.getFullYear() === now.getFullYear() && feeDate.getMonth() === now.getMonth();
    })
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const pendingAmount = fees
    .filter((fee) => fee.status === 'pending')
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const todayCollection = fees
    .filter((fee) => fee.status === 'paid' && fee.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const selectedStudent = students.find((student) => String(student.id) === formData.student_id);
  const selectedStudentPendingFees = selectedStudent
    ? fees
        .filter((fee) => fee.student_id === selectedStudent.id && fee.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const selectedPendingFee = selectedStudentPendingFees.find((fee) => String(fee.id) === selectedPendingFeeId) || null;
  const matchingStudents = students.filter((student) => {
    if (!studentSearch.trim()) {
      return true;
    }

    const query = studentSearch.toLowerCase();
    return (
      String(student.name || '').toLowerCase().includes(query) ||
      String(student.reg_no || '').toLowerCase().includes(query)
    );
  });
  const selectedStudentTotalFee = !selectedStudent ? 0 : (() => {
    const d = selectedStudent.dynamic_fees;
    if (d) {
      return Number(d.dynamic_admission_fee || 0) + Number(d.dynamic_coaching_fee || 0) + Number(d.dynamic_transport_fee || 0) + Number(d.dynamic_entrance_fee || 0) + Number(d.dynamic_fooding_fee || 0);
    }
    return Number(selectedStudent.admission_fee || 0) +
      Number(selectedStudent.coaching_fee || 0) +
      Number(selectedStudent.transport_fee || 0) +
      Number(selectedStudent.entrance_fee || 0) +
      Number(selectedStudent.fooding_fee || 0);
  })();
  const selectedStudentPaidAmount = selectedStudent
    ? fees
        .filter((fee) => fee.student_id === selectedStudent.id && fee.status === 'paid')
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
    : 0;
  const selectedStudentDueAmount = Math.max(selectedStudentTotalFee - selectedStudentPaidAmount, 0);
  const selectedStudentPendingTotal = selectedStudentPendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const profileStudentPendingFees = profileStudent
    ? fees
        .filter((fee) => fee.student_id === profileStudent.id && fee.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const profileStudentPaidFees = profileStudent
    ? fees
        .filter((fee) => fee.student_id === profileStudent.id && fee.status === 'paid')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const profileStudentPendingTotal = profileStudentPendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const profileStudentPaidTotal = profileStudentPaidFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find((item) => String(item.id) === studentId);
    const pendingFeesForStudent = fees
      .filter((fee) => fee.student_id === student?.id && fee.status === 'pending')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstPendingFee = pendingFeesForStudent[0];
    const totalFee = !student ? 0 : (() => {
      const d = student.dynamic_fees;
      if (d) {
        return Number(d.dynamic_admission_fee || 0) + Number(d.dynamic_coaching_fee || 0) + Number(d.dynamic_transport_fee || 0) + Number(d.dynamic_entrance_fee || 0) + Number(d.dynamic_fooding_fee || 0);
      }
      return Number(student.admission_fee || 0) +
        Number(student.coaching_fee || 0) +
        Number(student.transport_fee || 0) +
        Number(student.entrance_fee || 0) +
        Number(student.fooding_fee || 0);
    })();
    const paidAmount = student
      ? fees
          .filter((fee) => fee.student_id === student.id && fee.status === 'paid')
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
      : 0;
    const dueAmount = Math.max(totalFee - paidAmount, 0);

    setSelectedPendingFeeId(firstPendingFee ? String(firstPendingFee.id) : '');
    setFormData({
      ...formData,
      student_id: studentId,
      discount: '0',
      amount: firstPendingFee ? String(firstPendingFee.amount || 0) : dueAmount ? String(dueAmount) : '',
      type: firstPendingFee?.type || formData.type,
      reference_no: '',
    });
    setStudentSearch(student ? `${student.name} (${student.reg_no})` : '');
  };

  const handlePendingFeeChange = (feeId: string) => {
    setSelectedPendingFeeId(feeId);
    const fee = selectedStudentPendingFees.find((item) => String(item.id) === feeId);
    if (!fee) return;

    setFormData((prev) => ({
      ...prev,
      type: fee.type,
      discount: '0',
      amount: String(fee.amount || 0),
    }));
  };

  const openStudentProfile = (studentId: number) => {
    const student = students.find((item) => item.id === studentId) || null;
    setProfileStudent(student);
  };

  const handleDiscountChange = (discountValue: string) => {
    const discount = Number(discountValue || 0);
    const baseAmount = selectedPendingFee ? Number(selectedPendingFee.amount || 0) : selectedStudentDueAmount;
    const finalAmount = Math.max(baseAmount - discount, 0);
    setFormData({
      ...formData,
      discount: discountValue,
      amount: selectedStudent ? String(finalAmount) : formData.amount,
    });
  };

  const handlePrintReceipt = (fee: any) => {
    const student = students.find((item) => item.id === fee.student_id);
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
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              background: #fff;
              color: #111827;
            }
            .sheet {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .receipt {
              border: 1px solid #9ca3af;
              padding: 8px 10px;
            }
            .receipt-title {
              text-align: center;
              text-decoration: underline;
              font-size: 13px;
              margin-bottom: 4px;
            }
            .school-name {
              text-align: center;
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .school-meta {
              text-align: center;
              font-size: 13px;
              margin-bottom: 2px;
            }
            .row {
              font-size: 13px;
              margin-top: 8px;
            }
            .spread {
              display: flex;
              justify-content: space-between;
              gap: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #9ca3af;
              padding: 5px 6px;
              text-align: left;
            }
            th:last-child, td:last-child {
              text-align: right;
            }
            .footer-note {
              margin-top: 8px;
              font-size: 11px;
            }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fees & Dues</h1>
          <p className="text-slate-500">Collect payments, clear pending dues, and print student receipts.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/fees/reports"
            className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
          >
            Due Reports
            <ArrowRight className="w-4 h-4" />
          </Link>
          {user?.role === 'admin' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-200"
            >
              <Plus className="w-5 h-5" />
              Collect Payment
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Collected This Month</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Pending Dues</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Collected Today</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(todayCollection)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by receipt, student, ledger or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <Link
            to="/fees/reports"
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Open Due Reports
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Bill No</th>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Fee Type</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                {user?.role === 'admin' && (
                  <th className="px-6 py-4 font-semibold text-center">Edit</th>
                )}
                <th className="px-6 py-4 font-semibold text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{fee.bill_no}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => openStudentProfile(fee.student_id)}
                      className="rounded-md text-left text-indigo-700 transition-colors hover:text-indigo-900 hover:underline"
                    >
                      {fee.student_name}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{fee.type}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(Number(fee.amount))}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(fee.date), 'MMM dd, yyyy')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {fee.status}
                    </span>
                  </td>
                  {user?.role === 'admin' && (
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => openEditModal(fee)}
                        className="p-2 hover:bg-slate-100 hover:shadow-sm rounded-lg text-emerald-600 transition-all font-medium text-xs border border-emerald-100 bg-emerald-50"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handlePrintReceipt(fee)}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-indigo-600 transition-all"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredFees.length === 0 && (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 8 : 7} className="px-6 py-10 text-center text-sm text-slate-500">
                    No fee records match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50 gap-4">
            <div className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-semibold text-slate-900">{Math.min(currentPage * pageSize, filteredFees.length)}</span> of <span className="font-semibold text-slate-900">{filteredFees.length}</span> entries
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, index, array) => (
                  <React.Fragment key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 py-1.5 text-slate-400">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? 'bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  </React.Fragment>
              ))}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Student Details
                {selectedStudent?.reg_no ? (
                  <>
                    {' '}for Student :{' '}
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                      {selectedStudent.reg_no}
                    </span>
                  </>
                ) : null}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-8 p-8">
              <div className="space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-500">Select Student</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="Type student name or registration no."
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setSelectedPendingFeeId('');
                        setFormData({
                          ...formData,
                          student_id: '',
                          discount: '0',
                          amount: '',
                          reference_no: '',
                        });
                      }}
                    />
                    {studentSearch.trim() && !formData.student_id && (
                      <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {matchingStudents.length > 0 ? matchingStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleStudentSelect(String(student.id))}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-900">{student.name}</span>
                            <span className="text-sm text-slate-500">{student.reg_no}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm text-slate-500">No matching students found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fee Ledger</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    disabled={Boolean(selectedPendingFee)}
                  >
                    {ledgers.map(l => (
                      <option key={l.id} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Student Name</label>
                  <input
                    readOnly
                    value={selectedStudent?.name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Father Name</label>
                  <input
                    readOnly
                    value={selectedStudent?.father_name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mobile No.</label>
                  <input
                    readOnly
                    value={selectedStudent?.phone || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Due Amount</label>
                  <input
                    readOnly
                    value={selectedStudent ? String(selectedPendingFee ? selectedPendingFee.amount : selectedStudentPendingTotal || selectedStudentDueAmount) : ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Session</label>
                  <input
                    readOnly
                    value={selectedStudent?.session || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Study Class</label>
                  <input
                    readOnly
                    value={selectedStudent?.class_name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-4">
                  <label className="text-sm font-semibold text-slate-700">Pending Fee To Settle</label>
                  <select
                    value={selectedPendingFeeId}
                    onChange={(e) => handlePendingFeeChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    disabled={!selectedStudent || selectedStudentPendingFees.length === 0}
                  >
                    {selectedStudentPendingFees.length === 0 ? (
                      <option value="">No pending fee rows for this student</option>
                    ) : (
                      selectedStudentPendingFees.map((fee) => (
                        <option key={fee.id} value={fee.id}>
                          {fee.type} - {formatCurrency(Number(fee.amount || 0))} - {fee.bill_no}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Discount</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fee</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full bg-slate-50 border-none rounded-xl py-2.5 pl-11 pr-4 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mode</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Reference No.</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
                <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Payment Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
                </div>
                <button 
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                >
                  Save and Print
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && editingFee && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Edit Fee Amount</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-6 p-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-900">{editingFee.student_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Bill No:</span>
                  <span className="font-semibold text-slate-900">{editingFee.bill_no}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fee Type:</span>
                  <span className="font-semibold text-slate-900">{editingFee.type}</span>
                </div>
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-sm font-semibold text-slate-700">Update Amount <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ amount: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button 
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white transition-all hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {profileStudent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{profileStudent.name}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {profileStudent.reg_no} • {profileStudent.class_name} • {profileStudent.session}
                </p>
              </div>
              <button
                onClick={() => setProfileStudent(null)}
                className="rounded-full p-2 transition-colors hover:bg-slate-100"
              >
                <Plus className="h-6 w-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Basic Details</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Date of Join</span><span className="text-right font-semibold text-slate-900">{profileStudent.admission_date || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Date of Birth</span><span className="text-right font-semibold text-slate-900">{profileStudent.dob || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Gender</span><span className="text-right font-semibold text-slate-900">{profileStudent.gender || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Stream</span><span className="text-right font-semibold text-slate-900">{profileStudent.stream || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="text-right font-semibold capitalize text-slate-900">{profileStudent.status || 'NA'}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Contact Details</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Father</span><span className="text-right font-semibold text-slate-900">{profileStudent.father_name || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Mother</span><span className="text-right font-semibold text-slate-900">{profileStudent.mother_name || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Student Phone</span><span className="text-right font-semibold text-slate-900">{profileStudent.phone || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Father Phone</span><span className="text-right font-semibold text-slate-900">{profileStudent.father_phone || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="text-right font-semibold text-slate-900">{profileStudent.address || 'NA'}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Fee Summary</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Pending Rows</span><span className="text-right font-semibold text-rose-600">{profileStudentPendingFees.length}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Pending Amount</span><span className="text-right font-semibold text-rose-600">{formatCurrency(profileStudentPendingTotal)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Paid Rows</span><span className="text-right font-semibold text-emerald-600">{profileStudentPaidFees.length}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Paid Amount</span><span className="text-right font-semibold text-emerald-600">{formatCurrency(profileStudentPaidTotal)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Hostel</span><span className="text-right font-semibold text-slate-900">{profileStudent.hostel_required || 'NA'}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Pending Dues</h4>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {profileStudentPendingFees.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-slate-500">No pending dues for this student.</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Ledger</th>
                            <th className="px-5 py-3 font-semibold">Bill No</th>
                            <th className="px-5 py-3 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profileStudentPendingFees.map((fee) => (
                            <tr key={fee.id}>
                              <td className="px-5 py-3 text-slate-700">{fee.type}</td>
                              <td className="px-5 py-3 font-mono text-xs text-slate-500">{fee.bill_no}</td>
                              <td className="px-5 py-3 text-right font-semibold text-rose-600">{formatCurrency(Number(fee.amount || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Recent Payments</h4>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {profileStudentPaidFees.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-slate-500">No payments recorded yet.</div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Ledger</th>
                            <th className="px-5 py-3 font-semibold">Date</th>
                            <th className="px-5 py-3 font-semibold text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {profileStudentPaidFees.slice(0, 10).map((fee) => (
                            <tr key={fee.id}>
                              <td className="px-5 py-3 text-slate-700">{fee.type}</td>
                              <td className="px-5 py-3 text-slate-500">{format(new Date(fee.date), 'MMM dd, yyyy')}</td>
                              <td className="px-5 py-3 text-right font-semibold text-emerald-600">{formatCurrency(Number(fee.amount || 0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
