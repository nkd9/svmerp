import React, { useState, useEffect } from 'react';
import { Wallet, ArrowUpCircle, ArrowDownCircle, History, Search, Plus, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function FoodWallet() {
  const { user } = useAuth();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const [topupAmount, setTopupAmount] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    fetchStudents();
  }, [studentSearch]);

  const fetchStudents = async () => {
    const searchParams = new URLSearchParams({
      status: 'active',
      view: 'summary',
      limit: '100',
    });
    if (studentSearch.trim()) {
      searchParams.set('search', studentSearch.trim());
    }

    const res = await fetch(`/api/students?${searchParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setStudents(await res.json());
  };

  const fetchWallet = async (studentId: number) => {
    const res = await fetch(`/api/wallet/${studentId}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const data = await res.json();
    setBalance(data.balance);
  };

  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
    fetchWallet(student.id);
  };

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !topupAmount) return;
    if (user?.role !== 'admin') {
      alert('Only admin can modify financial information.');
      return;
    }

    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ student_id: selectedStudent.id, amount: parseFloat(topupAmount) })
    });

    if (res.ok) {
      fetchWallet(selectedStudent.id);
      setIsModalOpen(false);
      setTopupAmount('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Food Wallet System</h1>
          <p className="text-slate-500">Manage student meal credits and transactions.</p>
        </div>
        {user?.role === 'admin' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={!selectedStudent}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            Add Credits
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Student Selector */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search student..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {students.map(s => (
              <button
                key={s.id}
                onClick={() => handleStudentSelect(s)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  selectedStudent?.id === s.id ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedStudent?.id === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {s.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold">{s.name}</p>
                  <p className="text-[10px] opacity-70 uppercase tracking-wider">{s.reg_no}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Details */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedStudent ? (
            <div className="bg-white h-full rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center p-12">
              <Wallet className="w-16 h-16 text-slate-200 mb-4" />
              <h3 className="text-xl font-bold text-slate-900">Select a Student</h3>
              <p className="text-slate-500 mt-2">Choose a student from the list to view their wallet balance and history.</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl shadow-xl shadow-indigo-200 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-widest mb-1">Current Balance</p>
                  <h2 className="text-5xl font-bold tracking-tight">{formatCurrency(balance)}</h2>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                      <p className="text-[10px] text-indigo-100 uppercase font-bold">Student Name</p>
                      <p className="font-bold">{selectedStudent.name}</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20">
                      <p className="text-[10px] text-indigo-100 uppercase font-bold">Reg No</p>
                      <p className="font-bold">{selectedStudent.reg_no}</p>
                    </div>
                  </div>
                </div>
                <Wallet className="absolute -right-8 -bottom-8 w-64 h-64 text-white/5 rotate-12" />
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">Transaction History</h3>
                  <History className="w-5 h-5 text-slate-400" />
                </div>
                <div className="p-6 space-y-6">
                  {/* Mock transactions for UI */}
                  {[
                    { id: 1, type: 'topup', amount: 50, date: '2026-03-09 10:30 AM', desc: 'Wallet Top-up' },
                    { id: 2, type: 'expense', amount: 4.5, date: '2026-03-09 12:45 PM', desc: 'Lunch - Cafeteria' },
                    { id: 3, type: 'expense', amount: 2.0, date: '2026-03-08 04:15 PM', desc: 'Snacks - Canteen' },
                  ].map(tx => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-xl ${tx.type === 'topup' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {tx.type === 'topup' ? <ArrowUpCircle className="w-5 h-5" /> : <ArrowDownCircle className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{tx.desc}</p>
                          <p className="text-xs text-slate-500">{tx.date}</p>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${tx.type === 'topup' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'topup' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Add Wallet Credits</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleTopup} className="p-6 space-y-6">
              <div className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Adding credits for</p>
                <p className="text-lg font-bold text-slate-900">{selectedStudent?.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Amount to Add</label>
                <div className="relative">
                  <IndianRupee className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 text-lg font-bold"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Confirm Top-up
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
