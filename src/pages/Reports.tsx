import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, TrendingUp, Download, Search, ArrowRight, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { printReport } from '../utils/print';
import {
  Button,
  EmptyTableRow,
  Input,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableToolbar,
} from '../components/ui';

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

export default function Reports() {
  const navigate = useNavigate();
  const [pendingFees, setPendingFees] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [pendingRes, collectionRes] = await Promise.all([
        fetch('/api/reports/fee-pending', { headers }),
        fetch(`/api/reports/collection?start=2026-01-01&end=${format(new Date(), 'yyyy-MM-dd')}`, { headers }),
      ]);

      setPendingFees(await pendingRes.json());
      setCollection(await collectionRes.json());
    } finally {
      setLoading(false);
    }
  };

  const filteredPendingFees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return pendingFees;
    }

    return pendingFees.filter((item) =>
      [item.name, item.reg_no, item.class_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [pendingFees, searchQuery]);

  const pendingFeeExportRows = useMemo(
    () =>
      pendingFees.map((item) => ({
        'Student Name': item.name,
        'Registration No': item.reg_no,
        'Phone Number': item.phone || '',
        Class: item.class_name,
        'Total Amount': Number(item.total_amount || 0),
        'Paid Amount': Number(item.paid_amount || 0),
        'Pending Amount': Number(item.pending_amount || 0),
      })),
    [pendingFees],
  );

  const collectionExportRows = useMemo(
    () =>
      collection.map((item) => ({
        Date: item.date,
        'Collected Amount': Number(item.total || 0),
      })),
    [collection],
  );

  const handleDueExport = () => {
    downloadExcelFile(pendingFeeExportRows, 'due-report');
  };

  const handleCollectionExport = () => {
    downloadExcelFile(collectionExportRows, 'collection-report');
  };

  const handleSendReminder = (item: any) => {
    const message = encodeURIComponent(
      `Dear ${item.name}, total fee ${formatCurrency(Number(item.total_amount || 0))}, paid ${formatCurrency(Number(item.paid_amount || 0))}, pending ${formatCurrency(Number(item.pending_amount || 0))}. Please contact the college office.`,
    );
    window.open(`https://wa.me/?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-slate-500 shadow-sm">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500">Use quick exports here or open the full dues and collection reporting workspace.</p>
        </div>
        <button
          onClick={() => navigate('/fees/reports')}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Open Fee Reports
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div id="due-reports" className="scroll-mt-24 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900">Due Reports</h3>
          </div>
          <p className="mb-3 text-sm text-slate-500">Export student-wise outstanding balances from the current fee summary.</p>
          <p className="mb-6 text-sm font-semibold text-slate-700">{pendingFees.length} students with pending dues</p>
          <div className="flex gap-3">
            <button
              onClick={() => printReport('Due Report', pendingFeeExportRows)}
              className="flex-1 rounded-xl bg-slate-50 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" />
                Print
              </span>
            </button>
            <button
              onClick={handleDueExport}
              className="flex-1 rounded-xl bg-slate-50 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </span>
            </button>
            <button
              onClick={() => navigate('/fees/reports')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open
            </button>
          </div>
        </div>

        <div id="collection-reports" className="scroll-mt-24 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-900">Collection Reports</h3>
          </div>
          <p className="mb-3 text-sm text-slate-500">Export the date-wise collection summary already loaded on this page.</p>
          <p className="mb-6 text-sm font-semibold text-slate-700">{collection.length} collection dates available</p>
          <div className="flex gap-3">
            <button
              onClick={() => printReport('Collection Report', collectionExportRows)}
              className="flex-1 rounded-xl bg-slate-50 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Printer className="h-4 w-4" />
                Print
              </span>
            </button>
            <button
              onClick={handleCollectionExport}
              className="flex-1 rounded-xl bg-slate-50 py-2.5 font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Download className="h-4 w-4" />
                Export Excel
              </span>
            </button>
            <button
              onClick={() => navigate('/fees/reports')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Open
            </button>
          </div>
        </div>
      </div>

      <TableContainer id="pending-due-list" className="scroll-mt-24">
        <TableToolbar className="flex-col items-stretch p-6 md:flex-row md:items-center">
          <h3 className="font-bold text-slate-900">Pending Due List</h3>
          <div className="relative w-full md:w-64">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, reg no, class..."
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </TableToolbar>
        <div className="grid gap-4 p-4 md:hidden">
          {filteredPendingFees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center italic text-slate-400">
              No matching pending dues found.
            </div>
          ) : (
            filteredPendingFees.map((item, idx) => (
              <div
                key={`${item.reg_no}-${idx}`}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.reg_no}</p>
                  </div>
                  <button
                    onClick={() => handleSendReminder(item)}
                    className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
                  >
                    Send Reminder
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</p>
                    <p className="mt-1 text-slate-700">{item.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Class</p>
                    <p className="mt-1 text-slate-700">{item.class_name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
                    <p className="mt-1 font-semibold text-slate-700">{formatCurrency(Number(item.total_amount || 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paid</p>
                    <p className="mt-1 font-semibold text-emerald-600">{formatCurrency(Number(item.paid_amount || 0))}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending</p>
                    <p className="mt-1 font-bold text-rose-600">{formatCurrency(Number(item.pending_amount || 0))}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Student</TableHeaderCell>
                <TableHeaderCell>Reg No</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Total Amount</TableHeaderCell>
                <TableHeaderCell>Paid Amount</TableHeaderCell>
                <TableHeaderCell>Pending Amount</TableHeaderCell>
                <TableHeaderCell className="text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPendingFees.length === 0 ? (
                <EmptyTableRow colSpan={8}>No matching pending dues found.</EmptyTableRow>
              ) : (
                filteredPendingFees.map((item, idx) => (
                  <TableRow key={`${item.reg_no}-${idx}`}>
                    <TableCell className="font-semibold text-slate-900">{item.name}</TableCell>
                    <TableCell>{item.reg_no}</TableCell>
                    <TableCell>{item.phone || '-'}</TableCell>
                    <TableCell>{item.class_name}</TableCell>
                    <TableCell className="font-semibold text-slate-700">
                      {formatCurrency(Number(item.total_amount || 0))}
                    </TableCell>
                    <TableCell className="font-semibold text-emerald-600">
                      {formatCurrency(Number(item.paid_amount || 0))}
                    </TableCell>
                    <TableCell className="font-bold text-rose-600">
                      {formatCurrency(Number(item.pending_amount || 0))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSendReminder(item)}
                        className="text-indigo-600"
                      >
                        Send Reminder
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TableContainer>
    </div>
  );
}
