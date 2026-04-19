import { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Search, Filter, Save } from 'lucide-react';
import { format } from 'date-fns';
import {
  Button,
  Card,
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
} from '../components/ui';

export default function Attendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    const res = await fetch('/api/classes', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    setClasses(await res.json());
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    setLoading(true);
    const res = await fetch('/api/students', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    const allStudents = await res.json();
    const filtered = allStudents.filter((s: any) => s.class_id === parseInt(selectedClass));
    setStudents(filtered);
    
    // Initialize attendance as all present
    const initial: Record<number, string> = {};
    filtered.forEach((s: any) => initial[s.id] = 'present');
    setAttendance(initial);
    setLoading(false);
  };

  const handleStatusChange = (studentId: number, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const saveAttendance = async () => {
    const promises = Object.entries(attendance).map(([studentId, status]) => 
      fetch('/api/attendance', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ student_id: parseInt(studentId), date, status })
      })
    );
    await Promise.all(promises);
    alert('Attendance saved successfully!');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance System"
        description="Track daily student attendance."
        actions={
          <>
          <Input 
            type="date" 
            className="bg-white"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button 
            onClick={saveAttendance}
            disabled={students.length === 0}
            className="px-6 font-bold"
          >
            <Save className="w-5 h-5" />
            Save Attendance
          </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Select Class</label>
          <Select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">Choose Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Button 
          variant="secondary"
          onClick={fetchStudents}
          className="mt-6 px-6"
        >
          Load Students
        </Button>
      </Card>

      {students.length > 0 && (
        <TableContainer>
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow className="hover:bg-transparent">
                  <TableHeaderCell>Student</TableHeaderCell>
                  <TableHeaderCell>Reg No</TableHeaderCell>
                  <TableHeaderCell className="text-center">Status</TableHeaderCell>
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
                    <TableCell>{student.reg_no}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-4">
                        <button 
                          onClick={() => handleStatusChange(student.id, 'present')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            attendance[student.id] === 'present' 
                              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' 
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Present
                        </button>
                        <button 
                          onClick={() => handleStatusChange(student.id, 'absent')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            attendance[student.id] === 'absent' 
                              ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' 
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          Absent
                        </button>
                        <button 
                          onClick={() => handleStatusChange(student.id, 'late')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            attendance[student.id] === 'late' 
                              ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' 
                              : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <Clock className="w-4 h-4" />
                          Late
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TableContainer>
      )}
    </div>
  );
}
