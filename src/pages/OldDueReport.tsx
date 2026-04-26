import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, RefreshCw, Search } from 'lucide-react';
import {
  Button,
  EmptyTableRow,
  Input,
  MessageDialog,
  Pagination,
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

const OLD_DUE_PAGE_SIZE = 20;
const IMPORTED_OLD_DUE_REFERENCE = 'Imported from legacy old due report';

type OldDueFeeRow = {
  id: number;
  bill_no: string;
  type: string;
  amount: number;
  reference_no?: string;
  remark?: string;
  status: string;
  academic_session?: string;
  student_name?: string;
  student_reg_no?: string;
  student_phone?: string;
  student_class_name?: string;
  class_name?: string;
  old_due_reason?: string;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function OldDueReport() {
  const [rows, setRows] = useState<OldDueFeeRow[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string; tone?: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fees?status=pending&reference_no=${encodeURIComponent(IMPORTED_OLD_DUE_REFERENCE)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const contentType = res.headers.get('content-type') || '';
      const rawBody = await res.text();
      if (!contentType.includes('application/json')) {
        throw new Error(
          rawBody.startsWith('<!DOCTYPE') || rawBody.startsWith('<html')
            ? 'Old due API returned HTML instead of JSON. Please check the deployed backend.'
            : 'Old due API returned an unexpected response.',
        );
      }

      const data = JSON.parse(rawBody) as Array<Record<string, unknown>> | { error?: string };
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to load old due data.');
      }

      const nextRows = Array.isArray(data)
        ? data
            .filter((row) => String(row.reference_no || '') === IMPORTED_OLD_DUE_REFERENCE)
            .map((row) => ({
            ...row,
            amount: Number(row.amount || 0),
            bill_no: String(row.bill_no || ''),
            type: String(row.type || ''),
            student_name: String(row.student_name || ''),
            student_reg_no: String(row.student_reg_no || ''),
            student_phone: String(row.student_phone || ''),
            student_class_name: String(row.student_class_name || ''),
            }))
        : [];

      setRows(nextRows);
    } catch (error: any) {
      setRows([]);
      setNotice({
        title: 'Old Due Load Failed',
        message: error?.message || 'Failed to load old due data.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const classOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => String(row.class_name || row.student_class_name || '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => String(row.type || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    let result = [...rows];

    if (selectedClass) {
      result = result.filter((row) => String(row.class_name || row.student_class_name || '').trim() === selectedClass);
    }

    if (selectedCategory) {
      result = result.filter((row) => String(row.type || '').trim() === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter((row) =>
        [
          row.bill_no,
          row.student_reg_no,
          row.student_name,
          row.student_phone,
          row.class_name,
          row.student_class_name,
          row.type,
          row.reference_no,
          row.old_due_reason,
        ].some((value) => String(value || '').toLowerCase().includes(query)),
      );
    }

    return result.sort((a, b) => {
      const nameCompare = String(a.student_name || '').localeCompare(String(b.student_name || ''));
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return String(a.bill_no || '').localeCompare(String(b.bill_no || ''));
    });
  }, [rows, searchQuery, selectedCategory, selectedClass]);

  const filteredTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [filteredRows],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / OLD_DUE_PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * OLD_DUE_PAGE_SIZE;
    return filteredRows.slice(start, start + OLD_DUE_PAGE_SIZE);
  }, [currentPage, filteredRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedClass]);

  const handleExport = () => {
    if (!filteredRows.length) {
      setNotice({ title: 'No Data', message: 'No old due rows available to export.', tone: 'info' });
      return;
    }

    const exportRows = filteredRows.map((row) => ({
      'Bill No': row.bill_no,
      'Registration No': row.student_reg_no || '',
      Name: row.student_name || '',
      Phone: row.student_phone || '',
      'Due Amount': Number(row.amount || 0),
      Class: row.class_name || row.student_class_name || '',
      Category: row.type,
      Reference: row.reference_no || '',
    }));

    const headers = Object.keys(exportRows[0]);
    const escapeCell = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="UTF-8" /></head>
        <body>
          <table>
            <thead><tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr></thead>
            <tbody>${exportRows
              .map((row) => `<tr>${headers.map((header) => `<td>${escapeCell((row as Record<string, unknown>)[header])}</td>`).join('')}</tr>`)
              .join('')}</tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Old_Due_Report_Legacy.xls';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Old Due Report</h1>
          <p className="text-slate-500">
            Local old due data imported from the old ERP and served directly from our database.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void fetchData()}
            disabled={loading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh Data
          </Button>
          <Button type="button" onClick={handleExport} leftIcon={<Download className="h-4 w-4" />}>
            Export to Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Due Amount</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-rose-600">{formatCurrency(filteredTotal)}</p>
          <p className="mt-2 text-xs text-slate-500">Calculated from imported old due rows in our database.</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Rows</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-sky-700">{filteredRows.length}</p>
          <p className="mt-2 text-xs text-slate-500">Pending old due rows currently stored in our database.</p>
        </div>
      </div>

      <TableContainer>
        <TableToolbar className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Class</label>
            <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-white">
              <option value="">All Classes</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Category</label>
            <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-white">
              <option value="">All Categories</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Search</label>
            <Input
              type="text"
              placeholder="Search by bill no, student, phone, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="bg-white"
            />
          </div>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Bill No</TableHeaderCell>
                <TableHeaderCell>Registration No</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Due Amount</TableHeaderCell>
                <TableHeaderCell>Class</TableHeaderCell>
                <TableHeaderCell>Category</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedRows.map((row, index) => (
                <TableRow key={`${row.id}-${row.bill_no}-${index}`}>
                  <TableCell className="font-mono text-xs sm:text-sm">{row.bill_no}</TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm">{row.student_reg_no || '-'}</TableCell>
                  <TableCell className="font-semibold text-slate-900">{row.student_name || '-'}</TableCell>
                  <TableCell>{row.student_phone || '-'}</TableCell>
                  <TableCell className="font-bold text-rose-600">{formatCurrency(Number(row.amount || 0))}</TableCell>
                  <TableCell>{row.class_name || row.student_class_name || '-'}</TableCell>
                  <TableCell>{row.type}</TableCell>
                </TableRow>
              ))}
              {paginatedRows.length === 0 && (
                <EmptyTableRow colSpan={7}>
                  <div className="flex flex-col items-center justify-center text-slate-500">
                    <AlertCircle className="mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">No old due rows match your filters.</p>
                  </div>
                </EmptyTableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredRows.length}
          pageSize={OLD_DUE_PAGE_SIZE}
          itemName="old due rows"
          onPageChange={setCurrentPage}
        />
      </TableContainer>

      {notice ? (
        <MessageDialog
          title={notice.title}
          message={notice.message}
          tone={notice.tone}
          onClose={() => setNotice(null)}
        />
      ) : null}
    </div>
  );
}
