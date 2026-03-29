import React, { useState, useEffect } from 'react';
import { Search, Eye, Filter } from 'lucide-react';

interface Student {
  id: number;
  name: string;
  reg_no: string;
  class_id: number;
  class_name?: string;
  stream: string;
  session: string;
  phone: string;
}

export default function Alumni() {
  const [alumni, setAlumni] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSession, setFilterSession] = useState('');

  const fetchAlumni = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/admin/alumni', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setAlumni(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlumni();
  }, []);

  const availableSessions = Array.from(new Set(alumni.map(s => s.session).filter(Boolean)));
  const filteredAlumni = alumni.filter(s => 
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.reg_no.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterSession ? s.session === filterSession : true)
  );

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Alumni Directory</h1>
        <p className="text-slate-500">View graduated students and manage their historical dues.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Search alumni by name or reg no..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <select 
              value={filterSession} 
              onChange={e => setFilterSession(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Sessions</option>
              {availableSessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="border border-slate-100 rounded-xl overflow-hidden mt-6">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name & Reg No</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stream</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Graduation Session</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAlumni.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{s.name} <span className="text-slate-500 text-sm ml-2">{s.reg_no}</span></td>
                  <td className="px-6 py-4 text-slate-700">{s.stream}</td>
                  <td className="px-6 py-4 text-slate-700">{s.session}</td>
                  <td className="px-6 py-4 text-slate-700">{s.phone}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-indigo-600 hover:text-indigo-800 text-sm font-semibold">
                      Account / Fees
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAlumni.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No alumni found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
