import { useState, useEffect } from 'react';
import { Stethoscope, Activity, Plus, Search, FileText, Heart, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Button,
  Input,
  PageHeader,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableToolbar,
} from '../components/ui';

export default function Medical() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    const res = await fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setStudents(await res.json());
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="Monitor student health and medical history."
        actions={
        <Button className="bg-rose-600 shadow-rose-200 hover:bg-rose-700">
          <Plus className="w-5 h-5" />
          Add Medical Entry
        </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Critical Cases" value="02">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <Heart className="w-6 h-6" />
          </div>
          <div className="mt-4" />
        </StatCard>
        <StatCard label="Ongoing Recovery" value="08">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="mt-4" />
        </StatCard>
        <StatCard label="Total Checkups (Month)" value="45">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
          <div className="mt-4" />
        </StatCard>
      </div>

      <TableContainer>
        <TableToolbar>
          <h3 className="font-bold text-slate-900">Student Health Directory</h3>
          <div className="relative w-64">
            <Input type="text" placeholder="Search student health record..." leftIcon={<Search className="h-4 w-4" />} />
          </div>
        </TableToolbar>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Student</TableHeaderCell>
                <TableHeaderCell>Last Checkup</TableHeaderCell>
                <TableHeaderCell>Condition</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Records</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold text-xs">
                        {student.name.charAt(0)}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{student.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>Mar 08, 2026</TableCell>
                  <TableCell>General Checkup</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">Healthy</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-indigo-600 hover:bg-white hover:shadow-sm">
                      <FileText className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TableContainer>
    </div>
  );
}
