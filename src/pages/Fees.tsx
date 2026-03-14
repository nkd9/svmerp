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
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    type: 'Fee Collection',
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
    const [feesRes, studentsRes] = await Promise.all([
      fetch('/api/fees', { headers }),
      fetch('/api/students', { headers })
    ]);
    setFees(await feesRes.json());
    setStudents(await studentsRes.json());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin') {
      alert('Only admin can modify financial information.');
      return;
    }
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(formData)
    });
    if (res.ok) {
      const createdFee = await res.json();
      const printableFee = {
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
      setFormData({
        student_id: '', amount: '', type: 'Fee Collection',
        date: format(new Date(), 'yyyy-MM-dd'), status: 'paid',
        discount: '0', mode: 'Cash', reference_no: '',
        bill_no: `BILL-${Date.now()}`
      });
    }
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

  const totalCollected = fees
    .filter((fee) => fee.status === 'paid')
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const pendingAmount = fees
    .filter((fee) => fee.status === 'pending')
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const todayCollection = fees
    .filter((fee) => fee.status === 'paid' && fee.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const selectedStudent = students.find((student) => String(student.id) === formData.student_id);
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
  const selectedStudentTotalFee = selectedStudent
    ? Number(selectedStudent.admission_fee || 0) +
      Number(selectedStudent.coaching_fee || 0) +
      Number(selectedStudent.transport_fee || 0) +
      Number(selectedStudent.entrance_fee || 0) +
      Number(selectedStudent.fooding_fee || 0)
    : 0;
  const selectedStudentPaidAmount = selectedStudent
    ? fees
        .filter((fee) => fee.student_id === selectedStudent.id && fee.status === 'paid')
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
    : 0;
  const selectedStudentDueAmount = Math.max(selectedStudentTotalFee - selectedStudentPaidAmount, 0);

  const handleStudentSelect = (studentId: string) => {
    const student = students.find((item) => String(item.id) === studentId);
    const totalFee = student
      ? Number(student.admission_fee || 0) +
        Number(student.coaching_fee || 0) +
        Number(student.transport_fee || 0) +
        Number(student.entrance_fee || 0) +
        Number(student.fooding_fee || 0)
      : 0;
    const paidAmount = student
      ? fees
          .filter((fee) => fee.student_id === student.id && fee.status === 'paid')
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
      : 0;
    const dueAmount = Math.max(totalFee - paidAmount, 0);

    setFormData({
      ...formData,
      student_id: studentId,
      discount: '0',
      amount: dueAmount ? String(dueAmount) : '',
      reference_no: '',
    });
    setStudentSearch(student ? `${student.name} (${student.reg_no})` : '');
  };

  const handleDiscountChange = (discountValue: string) => {
    const discount = Number(discountValue || 0);
    const finalAmount = Math.max(selectedStudentDueAmount - discount, 0);
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
          <h1 className="text-2xl font-bold text-slate-900">Fee Management</h1>
          <p className="text-slate-500">Track collections and manage student accounts.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/fees/reports"
            className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
          >
            Fee Reports
            <ArrowRight className="w-4 h-4" />
          </Link>
          {user?.role === 'admin' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-200"
            >
              <Plus className="w-5 h-5" />
              Collect Fee
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Total Collected (Month)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Pending Dues</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm font-medium">Today's Collection</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(todayCollection)}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search transactions..."
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
            Open Reports
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
                <th className="px-6 py-4 font-semibold text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFees.map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{fee.bill_no}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-slate-900">{fee.student_name}</td>
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
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-500">
                    No fee records match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                    value={selectedStudent ? String(selectedStudentDueAmount) : ''}
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
    </div>
  );
}
