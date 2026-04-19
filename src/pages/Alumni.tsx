import React, { useState, useEffect } from 'react';
import { Search, Eye, Filter } from 'lucide-react';
import { academicSessionsMatch, convertLegacySessionLabel } from '../lib/academicSessions';
import {
  Button,
  EmptyTableRow,
  Input,
  PageHeader,
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

  const availableSessions = Array.from(new Set(alumni.map(s => convertLegacySessionLabel(s.session)).filter(Boolean)));
  const filteredAlumni = alumni.filter(s => 
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.reg_no.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (filterSession ? academicSessionsMatch(s.session, filterSession) : true)
  );

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Alumni Directory" description="View graduated students and manage their historical dues." />

      <TableContainer>
        <TableToolbar className="flex-col items-stretch md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search alumni by name or reg no..."
              leftIcon={<Search size={20} />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-64">
            <Select
              value={filterSession} 
              onChange={e => setFilterSession(e.target.value)}
            >
              <option value="">All Sessions</option>
              {availableSessions.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </TableToolbar>

        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Name & Reg No</TableHeaderCell>
                <TableHeaderCell>Stream</TableHeaderCell>
                <TableHeaderCell>Graduation Session</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAlumni.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-slate-900">{s.name} <span className="ml-2 text-sm text-slate-500">{s.reg_no}</span></TableCell>
                  <TableCell>{s.stream}</TableCell>
                  <TableCell>{convertLegacySessionLabel(s.session)}</TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600">
                      Account / Fees
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAlumni.length === 0 && (
                <EmptyTableRow colSpan={5}>No alumni found.</EmptyTableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TableContainer>
    </div>
  );
}
