import { useEffect, useMemo, useState } from 'react';
import { Users, IndianRupee, AlertCircle, Home, ArrowRight, GraduationCap, ReceiptIndianRupee, FileBarChart2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  Card,
  EmptyTableRow,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  const overviewCards = useMemo(() => {
    if (!stats) return [];

    const alumniCount = Math.max(Number(stats.totalStudents || 0) - Number(stats.activeStudents || 0), 0);
    return [
      { name: 'Active Students', value: Number(stats.activeStudents || 0), icon: Users, color: 'bg-blue-500' },
      { name: "Today's Collection", value: formatCurrency(Number(stats.todayFees || 0)), icon: IndianRupee, color: 'bg-emerald-500' },
      { name: 'Pending Dues', value: formatCurrency(Number(stats.pendingFees || 0)), icon: AlertCircle, color: 'bg-rose-500' },
      { name: 'Alumni', value: alumniCount, icon: GraduationCap, color: 'bg-amber-500' },
    ];
  }, [stats]);

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 py-7 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">SVM College ERP</p>
            <h1 className="mt-2 text-3xl font-bold">Arts and Science college operations in one place</h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-200">
              Use this dashboard to track current students, today&apos;s collections, pending dues, and the latest office activity.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/students" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20">
              Open Admissions
            </Link>
            <Link to="/fees" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20">
              Open Fees & Dues
            </Link>
            <Link to="/student-promotion" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20">
              Promotion & Graduation
            </Link>
            <Link to="/fees/reports" className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/20">
              Due Reports
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <StatCard key={card.name} label={card.name} value={card.value}>
            <div className="flex items-center justify-between">
              <div className={`${card.color} rounded-2xl p-3 text-white`}>
                <card.icon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-4" />
          </StatCard>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <ReceiptIndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Fee Desk</h2>
              <p className="text-sm text-slate-500">Collect fees, clear dues, and print receipts.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>Pending dues right now: <span className="font-semibold text-rose-600">{formatCurrency(Number(stats.pendingFees || 0))}</span></p>
            <p>Today&apos;s receipts: <span className="font-semibold text-emerald-600">{formatCurrency(Number(stats.todayFees || 0))}</span></p>
          </div>
          <Link to="/fees" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Open fee desk
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Admissions Desk</h2>
              <p className="text-sm text-slate-500">Current-year students only, class-wise filtering, and quick edits.</p>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>Active students: <span className="font-semibold text-slate-900">{Number(stats.activeStudents || 0)}</span></p>
            <p>Graduated / alumni records: <span className="font-semibold text-slate-900">{Math.max(Number(stats.totalStudents || 0) - Number(stats.activeStudents || 0), 0)}</span></p>
          </div>
          <Link to="/students" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Open admissions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
              <FileBarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Office Shortcuts</h2>
              <p className="text-sm text-slate-500">Go straight to dues, promotions, and reports.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <Link to="/fees/reports" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Open due reports</Link>
            <Link to="/student-promotion" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">Promote 1st year students</Link>
            <Link to="/alumni" className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">View alumni records</Link>
          </div>
        </Card>
      </div>

      <TableContainer>
        <div className="border-b border-slate-100 p-6">
          <h3 className="font-bold text-slate-900">Recent Financial Activity</h3>
          <p className="mt-1 text-sm text-slate-500">Latest receipts and fee updates recorded in the office.</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Receipt / Txn</TableHeaderCell>
                <TableHeaderCell>Student</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Entry</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(stats.recentTransactions || []).length === 0 ? (
                <EmptyTableRow colSpan={7}>No recent financial activity found.</EmptyTableRow>
              ) : (
                stats.recentTransactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-semibold text-slate-900">TX-{tx.id}</TableCell>
                    <TableCell className="font-medium text-slate-900">{tx.student_name}</TableCell>
                    <TableCell>{tx.phone || '-'}</TableCell>
                    <TableCell>{tx.class_name || '-'}</TableCell>
                    <TableCell>{tx.fee_type || tx.description || '-'}</TableCell>
                    <TableCell className="font-bold text-emerald-600">{formatCurrency(Number(tx.amount || 0))}</TableCell>
                    <TableCell>{tx.date ? format(new Date(tx.date), 'dd MMM yyyy') : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TableContainer>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
        Current working model: <span className="font-semibold text-slate-900">XI Arts, XII Arts, XI Science, XII Science</span>. Promotions move from first year to second year within the same stream, and passed-out second-year students move to alumni.
      </div>
    </div>
  );
}
