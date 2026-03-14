import React, { useState, useEffect } from 'react';
import { FileText, AlertCircle, TrendingUp, Calendar, Download, Search } from 'lucide-react';
import { format } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function Reports() {
  const [pendingFees, setPendingFees] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [pendingRes, collectionRes] = await Promise.all([
      fetch('/api/reports/fee-pending', { headers }),
      fetch(`/api/reports/collection?start=2026-01-01&end=${format(new Date(), 'yyyy-MM-dd')}`, { headers })
    ]);
    setPendingFees(await pendingRes.json());
    setCollection(await collectionRes.json());
    setLoading(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
        <p className="text-slate-500">Generate and view detailed institutional reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Due Reports</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">View all students with outstanding fee balances across all classes.</p>
          <button className="w-full py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Collection Reports</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">Daily and monthly fee collection summaries with transaction details.</p>
          <button className="w-full py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Download Excel
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">Attendance Reports</h3>
          </div>
          <p className="text-sm text-slate-500 mb-6">Class-wise and student-wise attendance percentage and history.</p>
          <button className="w-full py-2.5 bg-slate-50 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            View Full Report
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Fee Pending List</h3>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by name..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold">Reg No</th>
                <th className="px-6 py-4 font-semibold">Class</th>
                <th className="px-6 py-4 font-semibold">Pending Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingFees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">No pending dues found.</td>
                </tr>
              ) : (
                pendingFees.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{item.reg_no}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.class_name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-rose-600">{formatCurrency(Number(item.pending_amount))}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-indigo-600 text-xs font-bold hover:underline">Send Reminder</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
