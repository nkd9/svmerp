import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, CalendarDays, X, ReceiptIndianRupee, AlertCircle, ArrowLeft, Search, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { academicSessionsMatch, convertLegacySessionLabel } from '../lib/academicSessions';
import { printReport } from '../utils/print';

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

const TOTALABLE_AMOUNT_HEADERS = ['Total Amount', 'Paid Amount', 'Pending Amount', 'Amount'] as const;
const OLD_DUE_LEDGER_TYPES = new Set(['Coaching Fee', 'Food Fee', 'Hostel Fee', 'Transport Fee', 'Old Due Collection']);

const isAmountHeader = (header: string) =>
  TOTALABLE_AMOUNT_HEADERS.includes(header as (typeof TOTALABLE_AMOUNT_HEADERS)[number]);

const appendTotalsRow = (rows: ReportRow[]) => {
  if (!rows.length) {
    return rows;
  }

  const headers = Object.keys(rows[0]);
  const totalHeaders = headers.filter(isAmountHeader);
  if (totalHeaders.length === 0) {
    return rows;
  }

  const labelHeader =
    headers.find((header) => /student name|name|month|date|bill no/i.test(header)) ||
    headers[0];

  const totalRow = headers.reduce<ReportRow>((acc, header) => {
    if (header === labelHeader) {
      acc[header] = 'Total';
      return acc;
    }

    if (totalHeaders.includes(header as (typeof TOTALABLE_AMOUNT_HEADERS)[number])) {
      acc[header] = rows.reduce((sum, row) => sum + Number(row[header] || 0), 0);
      return acc;
    }

    acc[header] = '';
    return acc;
  }, {});

  return [...rows, totalRow];
};

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
  const [oldDueClass, setOldDueClass] = useState('');
  const [studentReportSearch, setStudentReportSearch] = useState('');
  const [selectedStudentForReport, setSelectedStudentForReport] = useState('');
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
    () => (Array.from(new Set(students.map((student) => convertLegacySessionLabel(String(student.session || ''))).filter(Boolean))) as string[]).sort((a, b) => b.localeCompare(a)),
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
  const studentReportMatches = useMemo(() => {
    const query = studentReportSearch.trim().toLowerCase();
    const sortedStudents = [...students].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')) || String(a.reg_no || '').localeCompare(String(b.reg_no || '')),
    );

    if (!query) {
      return sortedStudents.slice(0, 12);
    }

    return sortedStudents
      .filter((student) =>
        String(student.name || '').toLowerCase().includes(query) ||
        String(student.reg_no || '').toLowerCase().includes(query) ||
        String(student.phone || '').includes(studentReportSearch.trim()),
      )
      .slice(0, 12);
  }, [studentReportSearch, students]);

  const openReport = (title: string, rows: ReportRow[]) => {
    setActiveReportTitle(title);
    setReportRows(appendTotalsRow(rows));
    setIsReportModalOpen(true);
  };

  const generateAdmissionDueReport = () => {
    const rows = students
      .map((student) => {
        const paidAdmission = feesWithStudent
          .filter((fee) => fee.student_id === student.id && fee.type === 'Admission Fee' && fee.status === 'paid')
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const expectedAdmission = student.dynamic_fees ? Number(student.dynamic_fees.dynamic_admission_fee || 0) : Number(student.admission_fee || 0);
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

    openReport('Daily Collections Report', rows);
  };

  const generateOldDueReport = () => {
    const paidOldDueByStudent = feesWithStudent.reduce<Map<number, number>>((acc, fee) => {
      if (fee.status !== 'paid' || String(fee.type || '') !== 'Old Due Collection') {
        return acc;
      }

      const current = acc.get(Number(fee.student_id)) || 0;
      acc.set(Number(fee.student_id), current + Number(fee.amount || 0));
      return acc;
    }, new Map<number, number>());

    const grouped = new Map<
      number,
      {
        bill_no: string;
        reg_no: string;
        student_name: string;
        phone: string;
        educational_years: Set<string>;
        classes: Set<string>;
        ledgers: Set<string>;
        due_dates: Set<string>;
        pending_amount: number;
      }
    >();

    feesWithStudent
      .filter(
        (fee) =>
          fee.status === 'pending' &&
          OLD_DUE_LEDGER_TYPES.has(String(fee.type || '')) &&
          (!oldDueSession || academicSessionsMatch(String(fee.academic_session || fee.student?.session || ''), oldDueSession)) &&
          (!oldDueClass || String(classNameById.get(Number(fee.class_id)) || '') === oldDueClass),
      )
      .forEach((fee) => {
        const studentId = Number(fee.student_id);
        const current = grouped.get(studentId) || {
          bill_no: fee.bill_no,
          reg_no: fee.student?.reg_no || '',
          student_name: fee.student_name,
          phone: fee.student?.phone || '',
          educational_years: new Set<string>(),
          classes: new Set<string>(),
          ledgers: new Set<string>(),
          due_dates: new Set<string>(),
          pending_amount: 0,
        };

        const feeClassName = String(classNameById.get(Number(fee.class_id)) || fee.student?.class_name || '');
        const academicYear = convertLegacySessionLabel(String(fee.academic_session || fee.student?.session || ''));

        if (academicYear) current.educational_years.add(academicYear);
        if (feeClassName) current.classes.add(feeClassName);
        if (fee.type) current.ledgers.add(String(fee.type));
        if (fee.date) current.due_dates.add(String(fee.date));
        current.pending_amount += Number(fee.amount || 0);

        grouped.set(studentId, current);
      });

    const rows = Array.from(grouped.entries()).map(([studentId, item]) => {
      const paidAmount = paidOldDueByStudent.get(studentId) || 0;
      return {
        'Bill No': item.bill_no,
        'Registration No': item.reg_no,
        'Student Name': item.student_name,
        'Phone Number': item.phone,
        'Educational Year': Array.from(item.educational_years).join(', '),
        Class: Array.from(item.classes).join(', '),
        'Fee Ledger': Array.from(item.ledgers).join(', '),
        'Due Date': Array.from(item.due_dates).sort().join(', '),
        'Total Amount': paidAmount + item.pending_amount,
        'Paid Amount': paidAmount,
        'Pending Amount': item.pending_amount,
      };
    });

    const titleParts = ['Old Due Report'];
    if (oldDueSession) {
      titleParts.push(oldDueSession);
    }
    if (oldDueClass) {
      titleParts.push(oldDueClass);
    }

    openReport(titleParts.join(' - '), rows);
  };

  const generateStudentReport = () => {
    const student = students.find((item) => String(item.id) === selectedStudentForReport);
    if (!student) {
      alert('Please select a student first.');
      return;
    }

    const summary = getStudentSummary(student.id);
    const rows = feesWithStudent
      .filter((fee) => fee.student_id === student.id)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.bill_no || '').localeCompare(String(b.bill_no || '')))
      .map((fee) => ({
        Date: fee.date,
        'Bill No': fee.bill_no,
        'Registration No': student.reg_no || '',
        'Student Name': student.name || '',
        'Father Name': student.father_name || '',
        'Mother Name': student.mother_name || '',
        'Phone Number': student.phone || '',
        'Alt Phone Number': student.father_phone || student.mother_phone || '',
        Address: student.address || '',
        Gender: student.gender || '',
        Class: student.class_name || '',
        Section: student.section || '',
        Stream: student.stream || '',
        'Educational Year': convertLegacySessionLabel(String(student.session || '')),
        'Profile Admission Fee': student.dynamic_fees ? Number(student.dynamic_fees.dynamic_admission_fee || 0) : Number(student.admission_fee || 0),
        'Profile Coaching Fee': student.dynamic_fees ? Number(student.dynamic_fees.dynamic_coaching_fee || 0) : Number(student.coaching_fee || 0),
        'Profile Transport Fee': student.dynamic_fees ? Number(student.dynamic_fees.dynamic_transport_fee || 0) : Number(student.transport_fee || 0),
        'Profile Fooding Fee': student.dynamic_fees ? Number(student.dynamic_fees.dynamic_fooding_fee || 0) : Number(student.fooding_fee || 0),
        'Fee Ledger': fee.type,
        Status: fee.status,
        'Total Amount': summary.total_amount,
        'Paid Amount': fee.status === 'paid' ? Number(fee.amount || 0) : 0,
        'Pending Amount': fee.status === 'pending' ? Number(fee.amount || 0) : 0,
        Amount: Number(fee.amount || 0),
      }));

    openReport(`Student Fee Report - ${student.name} - ${student.reg_no}`, rows);
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
        const currentSession = convertLegacySessionLabel(String(student.session || ''));
        const feeSession = convertLegacySessionLabel(String(fee.academic_session || ''));
        const isPromotedDue =
          (fee.class_id && student.class_id && Number(fee.class_id) !== Number(student.class_id)) ||
          (feeSession && currentSession && feeSession !== currentSession);

        if (!isPromotedDue) {
          return;
        }

        if (promotedDueFilters.currentClass && currentClassName !== promotedDueFilters.currentClass) {
          return;
        }

        if (promotedDueFilters.currentSession && !academicSessionsMatch(currentSession, promotedDueFilters.currentSession)) {
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
        <section id="admission-due-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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

        <section id="student-fee-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
            <Search className="h-5 w-5" />
            <div>
              <h2 className="text-lg font-bold">Student Fee Report</h2>
              <p className="text-sm text-indigo-100">Search one student and view the full individual fee statement.</p>
            </div>
          </div>
          <div className="space-y-4 p-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Search Student</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={studentReportSearch}
                  onChange={(e) => {
                    setStudentReportSearch(e.target.value);
                    setSelectedStudentForReport('');
                  }}
                  placeholder="Type student name, reg no, or phone"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
                />
                {studentReportSearch.trim() && !selectedStudentForReport && (
                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {studentReportMatches.length > 0 ? studentReportMatches.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => {
                          setSelectedStudentForReport(String(student.id));
                          setStudentReportSearch(`${student.name} (${student.reg_no})`);
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{student.name}</span>
                        <span className="text-sm text-slate-500">{student.reg_no} - {student.class_name}</span>
                      </button>
                    )) : (
                      <div className="px-4 py-3 text-sm text-slate-500">No matching students found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={generateStudentReport}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
            >
              <Download className="h-4 w-4" />
              Generate Student Report
            </button>
          </div>
        </section>

        <section id="promoted-due-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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

        <section id="daily-collection-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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

        <section id="old-due-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Class</label>
              <select
                value={oldDueClass}
                onChange={(e) => setOldDueClass(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500"
              >
                <option value="">All Classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
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

        <section id="due-by-class-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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

        <section id="transaction-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
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

        <section id="monthly-report" className="scroll-mt-24 rounded-2xl border border-indigo-100 bg-white shadow-sm overflow-hidden xl:col-span-2">
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
                  onClick={() => printReport(activeReportTitle, reportRows)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Printer size={16} />
                  Print
                </button>
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
              ) : activeReportTitle.startsWith('Student Fee Report') ? (
                (() => {
                  const profileRow = reportRows[0];
                  const totalsRow = reportRows[reportRows.length - 1];
                  const transactions = reportRows.slice(0, -1);
                  return (
                    <div className="p-8 space-y-8 bg-slate-50">
                      {/* 1. Student Profile */}
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                          <h4 className="font-bold text-slate-800">Student Profile</h4>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold uppercase rounded-md tracking-wider">
                            Session: {String(profileRow['Educational Year'])}
                          </span>
                        </div>
                        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-6">
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Student Name</p>
                            <p className="font-bold text-slate-900">{String(profileRow['Student Name'])}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Registration No</p>
                            <p className="font-bold text-slate-900">{String(profileRow['Registration No'])}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Class & Section</p>
                            <p className="font-bold text-slate-900">{String(profileRow['Class'])}{profileRow['Section'] ? ` - ${String(profileRow['Section'])}` : ''}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Stream / Group</p>
                            <p className="font-bold text-slate-900">{String(profileRow['Stream']) || 'N/A'}</p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Father Name</p>
                            <p className="font-semibold text-slate-700">{String(profileRow['Father Name']) || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Mother Name</p>
                            <p className="font-semibold text-slate-700">{String(profileRow['Mother Name']) || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Phone Number</p>
                            <p className="font-semibold text-slate-700">{String(profileRow['Phone Number']) || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Address</p>
                            <p className="font-semibold text-slate-700 truncate" title={String(profileRow['Address'])}>{String(profileRow['Address']) || 'N/A'}</p>
                          </div>
                        </div>
                      </div>

                      {/* 2. Overviews / Gross Amounts */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4">
                            <h4 className="font-bold text-slate-800">Fee Profile (Gross Structure)</h4>
                          </div>
                          <div className="p-6 grid grid-cols-2 gap-6">
                            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-1">Admission Fee</p><p className="font-bold text-slate-900">{formatCurrency(Number(profileRow['Profile Admission Fee'] || 0))}</p></div>
                            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-1">Coaching Fee</p><p className="font-bold text-slate-900">{formatCurrency(Number(profileRow['Profile Coaching Fee'] || 0))}</p></div>
                            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-1">Transport Fee</p><p className="font-bold text-slate-900">{formatCurrency(Number(profileRow['Profile Transport Fee'] || 0))}</p></div>
                            <div><p className="text-xs text-slate-500 uppercase font-semibold mb-1">Fooding Fee</p><p className="font-bold text-slate-900">{formatCurrency(Number(profileRow['Profile Fooding Fee'] || 0))}</p></div>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col justify-center gap-6 p-8">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <p className="text-sm font-semibold text-slate-600">Total Basis Amount</p>
                            <p className="text-2xl font-bold text-slate-900">{formatCurrency(Number(profileRow['Total Amount'] || 0))}</p>
                          </div>
                          <div className="flex justify-between items-center bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-100">
                            <p className="text-sm font-semibold text-emerald-800">Total Paid Amount</p>
                            <p className="text-xl font-bold text-emerald-700">
                              {formatCurrency(Number(totalsRow['Paid Amount'] || 0))}
                            </p>
                          </div>
                          <div className="flex justify-between items-center bg-rose-50 px-4 py-3 rounded-xl border border-rose-100">
                            <p className="text-sm font-semibold text-rose-800">Total Pending Dues</p>
                            <p className="text-xl font-bold text-rose-700">
                              {formatCurrency(Number(totalsRow['Pending Amount'] || 0))}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 3. Transaction History */}
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex flex-col gap-1">
                          <h4 className="font-bold text-slate-800">Payment & Dues Transactions</h4>
                          <p className="text-xs text-slate-500">Breakdown of specific fee payments and dues.</p>
                        </div>
                        {transactions.length === 0 ? (
                          <div className="p-8 text-center text-slate-500">No transactions recorded for this student.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left whitespace-nowrap">
                              <thead className="bg-slate-50/50">
                                <tr className="border-b border-slate-100">
                                  <th className="px-6 py-3 text-xs font-semibold uppercase text-slate-500">Date</th>
                                  <th className="px-6 py-3 text-xs font-semibold uppercase text-slate-500">Bill No</th>
                                  <th className="px-6 py-3 text-xs font-semibold uppercase text-slate-500">Fee Ledger</th>
                                  <th className="px-6 py-3 text-xs font-semibold uppercase text-slate-500">Status</th>
                                  <th className="px-6 py-3 text-xs font-semibold uppercase text-slate-500 text-right">Row Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {transactions.map((t, index) => (
                                  <tr key={index} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 text-sm text-slate-700">{String(t['Date'])}</td>
                                    <td className="px-6 py-3 text-sm font-mono text-slate-500">{String(t['Bill No'])}</td>
                                    <td className="px-6 py-3 text-sm text-slate-700 font-medium">{String(t['Fee Ledger'])}</td>
                                    <td className="px-6 py-3">
                                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${t['Status'] === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {String(t['Status'])}
                                      </span>
                                    </td>
                                    <td className="px-6 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(Number(t['Amount']))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
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
                            {isAmountHeader(header)
                              ? row[header] === '' || row[header] === undefined || row[header] === null
                                ? '-'
                                : formatCurrency(Number(row[header] || 0))
                              : String(row[header] ?? '-')}
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
