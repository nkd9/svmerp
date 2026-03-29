import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, CalendarDays, X, ReceiptIndianRupee, AlertCircle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const downloadExcelFile = (rows: Array<Record<string, string | number>>, fileName: string) => {
  if (!rows.length) {
    alert('No data available to export');
    return;
  }

  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header] ?? '')}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xls`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

type ReportRow = Record<string, string | number>;

export default function FeeReports() {
  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportTitle, setActiveReportTitle] = useState('');
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [dailyCollectionDate, setDailyCollectionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [oldDueSession, setOldDueSession] = useState('');
  const [selectedClassForDue, setSelectedClassForDue] = useState('');
  const [promotedDueFilters, setPromotedDueFilters] = useState({
    currentClass: '',
    currentSession: '',
  });
  const [transactionFilters, setTransactionFilters] = useState({
    start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
    status: '',
    type: '',
  });
  const [monthlyFilters, setMonthlyFilters] = useState({
    year: String(new Date().getFullYear()),
  });

  useEffect(() => {
    const fetchData = async () => {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [feesRes, studentsRes, classesRes] = await Promise.all([
        fetch('/api/fees', { headers }),
        fetch('/api/students', { headers }),
        fetch('/api/classes', { headers }),
      ]);
      setFees(await feesRes.json());
      setStudents(await studentsRes.json());
      setClasses(await classesRes.json());
      setLoading(false);
    };

    fetchData();
  }, []);

  const feesWithStudent = useMemo(
    () =>
      fees.map((fee) => ({
        ...fee,
        student: students.find((student) => student.id === fee.student_id) || null,
      })),
    [fees, students],
  );

  const feeTypes = useMemo(
    () => Array.from(new Set(fees.map((fee) => String(fee.type || '')).filter(Boolean))),
    [fees],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(new Set(fees.map((fee) => String(fee.date || '').slice(0, 4)).filter(Boolean))).sort((a, b) => Number(b) - Number(a)),
    [fees],
  );
  const sessionOptions = useMemo(
    () => (Array.from(new Set(students.map((student) => String(student.session || '')).filter(Boolean))) as string[]).sort((a, b) => b.localeCompare(a)),
    [students],
  );

  const studentFeeSummary = useMemo(() => {
    const summary = new Map<
      number,
      {
        total_amount: number;
        paid_amount: number;
        pending_amount: number;
      }
    >();

    feesWithStudent.forEach((fee) => {
      if (!fee.student_id || fee.status === 'cancelled') {
        return;
      }

      const current = summary.get(fee.student_id) || {
        total_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
      };

      const amount = Number(fee.amount || 0);
      current.total_amount += amount;
      if (fee.status === 'paid') {
        current.paid_amount += amount;
      } else if (fee.status === 'pending') {
        current.pending_amount += amount;
      }

      summary.set(fee.student_id, current);
    });

    return summary;
  }, [feesWithStudent]);

  const getStudentSummary = (studentId?: number) =>
    studentFeeSummary.get(Number(studentId)) || {
      total_amount: 0,
      paid_amount: 0,
      pending_amount: 0,
    };
  const classOptions = useMemo(
    () => (Array.from(new Set(students.map((student) => String(student.class_name || '')).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b)),
    [students],
  );
  const classNameById = useMemo(
    () => new Map(classes.map((classItem) => [Number(classItem.id), String(classItem.name || '')])),
    [classes],
  );

  const openReport = (title: string, rows: ReportRow[]) => {
    setActiveReportTitle(title);
    setReportRows(rows);
    setIsReportModalOpen(true);
  };

  const generateAdmissionDueReport = () => {
    const rows = students
      .map((student) => {
        const paidAdmission = feesWithStudent
          .filter((fee) => fee.student_id === student.id && fee.type === 'Admission Fee' && fee.status === 'paid')
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const expectedAdmission = Number(student.admission_fee || 0);
        const dueAmount = Math.max(expectedAdmission - paidAdmission, 0);

        return {
          'Registration No': student.reg_no,
          'Student Name': student.name,
          'Phone Number': student.phone || '',
          Class: student.class_name || '',
          'Total Amount': expectedAdmission,
          'Paid Amount': paidAdmission,
          'Pending Amount': dueAmount,
        };
      })
      .filter((row) => Number(row['Pending Amount']) > 0);

    openReport('Admission Due Report', rows);
  };

  const generateDailyCollectionsReport = () => {
    const filteredRows = feesWithStudent.filter((fee) => fee.status === 'paid' && fee.date === dailyCollectionDate);
    const rows = filteredRows.map((fee) => {
      const summary = getStudentSummary(fee.student_id);
      return {
        Date: fee.date,
        'Bill No': fee.bill_no,
        'Student Name': fee.student_name,
        'Phone Number': fee.student?.phone || '',
        Class: fee.student?.class_name || '',
        'Fee Ledger': fee.type,
        'Total Amount': summary.total_amount,
        'Paid Amount': summary.paid_amount,
        'Pending Amount': summary.pending_amount,
        Amount: Number(fee.amount || 0),
      };
    });

    const total = filteredRows.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
    openReport(
      'Daily Collections Report',
      rows.length
        ? [
            ...rows,
            {
              Date: '',
              'Bill No': '',
              'Student Name': 'Total',
              'Phone Number': '',
              Class: '',
              'Fee Ledger': '',
              'Total Amount': '',
              'Paid Amount': '',
              'Pending Amount': '',
              Amount: total,
            },
          ]
        : [],
    );
  };

  const generateOldDueReport = () => {
    const rows = feesWithStudent
      .filter((fee) => fee.status === 'pending' && (!oldDueSession || fee.student?.session === oldDueSession))
      .map((fee) => {
        const summary = getStudentSummary(fee.student_id);
        return {
          'Bill No': fee.bill_no,
          'Registration No': fee.student?.reg_no || '',
          'Student Name': fee.student_name,
          'Phone Number': fee.student?.phone || '',
          'Educational Year': fee.student?.session || '',
          Class: fee.student?.class_name || '',
          'Fee Ledger': fee.type,
          'Due Date': fee.date,
          'Total Amount': summary.total_amount,
          'Paid Amount': summary.paid_amount,
          'Pending Amount': summary.pending_amount,
          Amount: Number(fee.amount || 0),
        };
      });

    openReport(`Old Due Report${oldDueSession ? ` - ${oldDueSession}` : ''}`, rows);
  };

  const generateDueByClassReport = () => {
    const studentStats = new Map<string, { reg_no: string; name: string; class_name: string; phone: string; total_amount: number; paid_amount: number; due_amount: number }>();

    feesWithStudent
      .filter((fee) => !selectedClassForDue || fee.student?.class_name === selectedClassForDue)
      .forEach((fee) => {
        if (!fee.student) return;
        
        const current = studentStats.get(fee.student.id) || {
          reg_no: fee.student.reg_no || '',
          name: fee.student.name || '',
          class_name: fee.student.class_name || '',
          phone: fee.student.phone || '',
          total_amount: 0,
          paid_amount: 0,
          due_amount: 0
        };
        
        if (fee.status !== 'cancelled') {
          const amount = Number(fee.amount || 0);
          current.total_amount += amount;
          if (fee.status === 'paid') {
            current.paid_amount += amount;
          } else if (fee.status === 'pending') {
            current.due_amount += amount;
          }
        }
        
        studentStats.set(fee.student.id, current);
      });

    const rows = Array.from(studentStats.values())
      .filter((student) => student.due_amount > 0)
      .map((student) => ({
        'Registration No': student.reg_no,
        'Student Name': student.name,
        Class: student.class_name,
        'Phone Number': student.phone,
        'Total Amount': student.total_amount,
        'Paid Amount': student.paid_amount,
        'Pending Amount': student.due_amount,
      }))
      .sort((a, b) => (a.Class || '').localeCompare(b.Class || '') || (a['Student Name'] || '').localeCompare(b['Student Name'] || ''));

    openReport(`Due By Class Report${selectedClassForDue ? ` - ${selectedClassForDue}` : ''}`, rows);
  };

  const generatePromotedDueReport = () => {
    const promotedStudentDueMap = new Map<
      number,
      {
        reg_no: string;
        name: string;
        phone: string;
        current_class: string;
        current_session: string;
        previous_classes: Set<string>;
        previous_sessions: Set<string>;
        fee_types: Set<string>;
        due_amount: number;
      }
    >();

    feesWithStudent
      .filter((fee) => fee.status === 'pending' && fee.student)
      .forEach((fee) => {
        const student = fee.student;
        const feeClassName = classNameById.get(Number(fee.class_id)) || '';
        const currentClassName = String(student.class_name || '');
        const currentSession = String(student.session || '');
        const feeSession = String(fee.academic_session || '');
        const isPromotedDue =
          (fee.class_id && student.class_id && Number(fee.class_id) !== Number(student.class_id)) ||
          (feeSession && currentSession && feeSession !== currentSession);

        if (!isPromotedDue) {
          return;
        }

        if (promotedDueFilters.currentClass && currentClassName !== promotedDueFilters.currentClass) {
          return;
        }

        if (promotedDueFilters.currentSession && currentSession !== promotedDueFilters.currentSession) {
          return;
        }

        const current = promotedStudentDueMap.get(Number(student.id)) || {
          reg_no: student.reg_no || '',
          name: student.name || '',
          phone: student.phone || '',
          current_class: currentClassName,
          current_session: currentSession,
          previous_classes: new Set<string>(),
          previous_sessions: new Set<string>(),
          fee_types: new Set<string>(),
          due_amount: 0,
        };

        if (feeClassName) {
          current.previous_classes.add(feeClassName);
        }
        if (feeSession) {
          current.previous_sessions.add(feeSession);
        }
        if (fee.type) {
          current.fee_types.add(String(fee.type));
        }
        current.due_amount += Number(fee.amount || 0);
        promotedStudentDueMap.set(Number(student.id), current);
      });

    const rows = Array.from(promotedStudentDueMap.values())
      .map((item) => ({
        'Registration No': item.reg_no,
        'Student Name': item.name,
        'Phone Number': item.phone,
        'Current Class': item.current_class,
        'Current Session': item.current_session,
        'Previous Class': Array.from(item.previous_classes).join(', '),
        'Previous Session': Array.from(item.previous_sessions).join(', '),
        'Pending Fee Ledgers': Array.from(item.fee_types).join(', '),
        'Pending Amount': item.due_amount,
      }))
      .sort((a, b) => (a['Current Class'] || '').localeCompare(b['Current Class'] || '') || (a['Student Name'] || '').localeCompare(b['Student Name'] || ''));

    openReport('Promoted Students Due Report', rows);
  };

  const generateTransactionReport = () => {
    const rows = feesWithStudent
      .filter((fee) => {
        if (transactionFilters.start && fee.date < transactionFilters.start) {
          return false;
        }
        if (transactionFilters.end && fee.date > transactionFilters.end) {
          return false;
        }
        if (transactionFilters.status && fee.status !== transactionFilters.status) {
          return false;
        }
        if (transactionFilters.type && fee.type !== transactionFilters.type) {
          return false;
        }
        return true;
      })
      .map((fee) => {
        const summary = getStudentSummary(fee.student_id);
        return {
          'Bill No': fee.bill_no,
          Date: fee.date,
          'Student Name': fee.student_name,
          'Registration No': fee.student?.reg_no || '',
          'Phone Number': fee.student?.phone || '',
          Class: fee.student?.class_name || '',
          'Fee Ledger': fee.type,
          'Total Amount': summary.total_amount,
          'Paid Amount': summary.paid_amount,
          'Pending Amount': summary.pending_amount,
          Status: fee.status,
          Amount: Number(fee.amount || 0),
        };
      });

    openReport('Transaction Report', rows);
  };

  const generateMonthlyReport = () => {
    const grouped = new Map<string, { paid: number; pending: number; total: number }>();

    feesWithStudent
      .filter((fee) => String(fee.date || '').startsWith(monthlyFilters.year))
      .forEach((fee) => {
        const monthKey = String(fee.date).slice(0, 7);
        const current = grouped.get(monthKey) || { paid: 0, pending: 0, total: 0 };
        current.total += Number(fee.amount || 0);
        if (fee.status === 'paid') {
          current.paid += Number(fee.amount || 0);
        } else {
          current.pending += Number(fee.amount || 0);
        }
        grouped.set(monthKey, current);
      });

    const rows = Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, totals]) => ({
        Month: month,
        'Paid Amount': totals.paid,
        'Pending Amount': totals.pending,
        'Total Amount': totals.total,
      }));

    openReport('Monthly Report', rows);
  };

  const reportHeaders = reportRows[0] ? Object.keys(reportRows[0]) : [];

  if (loading) {
    return <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm border border-slate-100">Loading fee reports...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fee Reports</h1>
          <p className="text-slate-500">Separate reporting workspace for dues, collections, and transaction summaries.</p>
        </div>
        <Link
          to="/fees"
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Fee Management
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <AlertCircle className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Admission Due</h2>
              <p className="text-sm text-indigo-100">Students with outstanding admission fee balance.</p>
            </div>
          </div>
          <div className="p-6">
            <button
              onClick={generateAdmissionDueReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Admission Due
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <History className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Promoted Students Due Report</h2>
              <p className="text-sm text-indigo-100">Pending dues carried by students after moving to the next class/session.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Current Class</label>
              <select
                value={promotedDueFilters.currentClass}
                onChange={(e) => setPromotedDueFilters((prev) => ({ ...prev, currentClass: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Current Classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Current Session</label>
              <select
                value={promotedDueFilters.currentSession}
                onChange={(e) => setPromotedDueFilters((prev) => ({ ...prev, currentSession: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Current Sessions</option>
                {sessionOptions.map((session) => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={generatePromotedDueReport}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
              >
                <Download className="h-4 w-4" />
                Generate Promoted Due Report
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <CalendarDays className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Daily Collections Report</h2>
              <p className="text-sm text-indigo-100">Date-wise paid collection register.</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Collection Date</label>
              <input
                type="date"
                value={dailyCollectionDate}
                onChange={(e) => setDailyCollectionDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              />
            </div>
            <button
              onClick={generateDailyCollectionsReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Daily Collection
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <History className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Old Due Report</h2>
              <p className="text-sm text-indigo-100">Pending fees filtered educational year wise.</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Educational Year</label>
              <select
                value={oldDueSession}
                onChange={(e) => setOldDueSession(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Educational Years</option>
                {sessionOptions.map((session) => (
                  <option key={session} value={session}>{session}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generateOldDueReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Old Due
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <AlertCircle className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Due By Class Report</h2>
              <p className="text-sm text-indigo-100">Total pending fees grouped by class.</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Class</label>
              <select
                value={selectedClassForDue}
                onChange={(e) => setSelectedClassForDue(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generateDueByClassReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Due By Class
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <ReceiptIndianRupee className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Transaction Report</h2>
              <p className="text-sm text-indigo-100">Detailed fee transaction listing with filters.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Start Date</label>
              <input
                type="date"
                value={transactionFilters.start}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, start: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                value={transactionFilters.end}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, end: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
              <select
                value={transactionFilters.status}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, status: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Fee Ledger</label>
              <select
                value={transactionFilters.type}
                onChange={(e) => setTransactionFilters({ ...transactionFilters, type: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Types</option>
                {feeTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button
                onClick={generateTransactionReport}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
              >
                <Download className="h-4 w-4" />
                Generate Transaction Report
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden xl:col-span-2">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <FileText className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Monthly Report</h2>
              <p className="text-sm text-indigo-100">Month-wise paid and pending fee totals.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end">
            <div className="w-full sm:max-w-xs">
              <label className="mb-2 block text-sm font-semibold text-slate-700">Year</label>
              <select
                value={monthlyFilters.year}
                onChange={(e) => setMonthlyFilters({ year: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                {(yearOptions.length ? yearOptions : [String(new Date().getFullYear())]).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button
              onClick={generateMonthlyReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Monthly Report
            </button>
          </div>
        </section>
      </div>

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-md">
          <div className="w-full max-w-6xl overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-8 py-5">
              <div>
                <h3 className="text-xl font-bold text-white">{activeReportTitle}</h3>
                <p className="text-sm text-indigo-100">{reportRows.length} records</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadExcelFile(reportRows, activeReportTitle.toLowerCase().replace(/\s+/g, '-'))}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Download size={16} />
                  Excel
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded-xl bg-white/15 p-2 text-white transition-all hover:bg-white/25"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="max-h-[75vh] overflow-auto">
              {reportRows.length === 0 ? (
                <div className="px-8 py-16 text-center">
                  <h4 className="text-lg font-semibold text-slate-900">No results found</h4>
                  <p className="mt-2 text-sm text-slate-500">Try changing the filters and generate the report again.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      {reportHeaders.map((header) => (
                        <th key={header} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportRows.map((row, index) => (
                      <tr key={`${activeReportTitle}-${index}`} className="hover:bg-slate-50">
                        {reportHeaders.map((header) => (
                          <td key={header} className="px-6 py-4 text-sm text-slate-700">
                            {header.toLowerCase().includes('amount') || header.toLowerCase() === 'paid' ? formatCurrency(Number(row[header] || 0)) : String(row[header] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
