import React, { useMemo, useState, useEffect } from 'react';
import { Plus, BookOpen, Award, FileText, X, Download, Search, UserRound, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

const formatPercentage = (obtained: number, max: number) => {
  if (!max) {
    return '0%';
  }

  return `${((obtained / max) * 100).toFixed(1)}%`;
};

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

  const tableRows = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeCell(row[header] ?? '')}</td>`).join('')}</tr>`)
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${escapeCell(header)}</th>`).join('')}</tr>
          </thead>
          <tbody>${tableRows}</tbody>
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

export default function Exams() {
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedExamForResults, setSelectedExamForResults] = useState<any | null>(null);
  
  const [examForm, setExamForm] = useState({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', full_marks: '100' });
  const [markForm, setMarkForm] = useState({ class_id: '', student_id: '', exam_id: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [subjectMarks, setSubjectMarks] = useState<Record<number, { marks_obtained: string; max_marks: string }>>({});
  const [subjectForm, setSubjectForm] = useState({ name: '', class_id: '' });
  const [subjectReportFilters, setSubjectReportFilters] = useState({ class_id: '', subject_id: '', exam_id: '' });
  const [examReportFilters, setExamReportFilters] = useState({ class_id: '', exam_id: '' });
  const [individualReportFilters, setIndividualReportFilters] = useState({ student_query: '', student_id: '', exam_id: '' });
  const [subjectReportData, setSubjectReportData] = useState<any[]>([]);
  const [subjectReportColumns, setSubjectReportColumns] = useState<Array<{ name: string; max_marks: number }>>([]);
  const [examReportData, setExamReportData] = useState<any[]>([]);
  const [individualReportData, setIndividualReportData] = useState<any[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportType, setActiveReportType] = useState<'subject' | 'exam' | 'individual' | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [examsRes, classesRes, subjectsRes, studentsRes, marksRes] = await Promise.all([
      fetch('/api/exams', { headers }),
      fetch('/api/classes', { headers }),
      fetch('/api/subjects', { headers }),
      fetch('/api/students', { headers }),
      fetch('/api/marks', { headers })
    ]);
    setExams(await examsRes.json());
    setClasses(await classesRes.json());
    setSubjects(await subjectsRes.json());
    setStudents(await studentsRes.json());
    setMarks(await marksRes.json());
    setLoading(false);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(examForm)
    });
    if (res.ok) {
      setIsExamModalOpen(false);
      fetchData();
      setExamForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', full_marks: '100' });
    }
  };

  const handleEnterMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    const marksPayload = filteredSubjects
      .map((subject) => ({
        student_id: Number(markForm.student_id),
        exam_id: Number(markForm.exam_id),
        subject_id: subject.id,
        marks_obtained: Number(subjectMarks[subject.id]?.marks_obtained || 0),
        max_marks: Number(subjectMarks[subject.id]?.max_marks || selectedExam?.full_marks || 100),
      }))
      .filter((item) => item.marks_obtained || item.max_marks);

    if (marksPayload.length === 0) {
      alert('Enter marks for at least one subject');
      return;
    }

    const res = await fetch('/api/marks/bulk', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ marks: marksPayload })
    });
    if (res.ok) {
      setIsMarkModalOpen(false);
      setMarkForm({ class_id: '', student_id: '', exam_id: '' });
      setStudentSearch('');
      setSubjectMarks({});
      fetchData();
      alert('Marks saved successfully!');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(subjectForm)
    });

    if (res.ok) {
      setIsSubjectModalOpen(false);
      setSubjectForm({ name: '', class_id: '' });
      fetchData();
    }
  };

  const handleViewResults = async (exam: any) => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const res = await fetch(`/api/marks?exam_id=${exam.id}`, { headers });
    if (res.ok) {
      setMarks(await res.json());
      setSelectedExamForResults(exam);
      setIsResultModalOpen(true);
    }
  };

  const selectedClassId = Number(markForm.class_id);
  const selectedExam = exams.find((exam) => String(exam.id) === markForm.exam_id);
  const filteredExams = selectedClassId
    ? exams.filter((exam) => exam.class_id === selectedClassId)
    : [];
  const filteredSubjects = selectedClassId
    ? subjects.filter((subject) => subject.class_id === selectedClassId)
    : [];
  const filteredStudents = selectedClassId
    ? students.filter((student) => student.class_id === selectedClassId)
    : [];
  const matchingStudents = filteredStudents.filter((student) => {
    if (!studentSearch.trim()) {
      return true;
    }

    const query = studentSearch.toLowerCase();
    return student.name.toLowerCase().includes(query) || student.reg_no.toLowerCase().includes(query);
  });
  const resultMarks = selectedExamForResults
    ? marks.filter((mark) => mark.exam_id === selectedExamForResults.id)
    : [];
  const resultColumns = useMemo(
    () =>
      Array.from(
        new Map(
          resultMarks.map((mark) => [
            String(mark.subject_name),
            { name: String(mark.subject_name), max_marks: Number(mark.max_marks) },
          ]),
        ).values(),
      ) as Array<{ name: string; max_marks: number }>,
    [resultMarks],
  );
  const resultRows = useMemo(
    () =>
      (Array.from(
        resultMarks.reduce((grouped, mark) => {
          const key = `${mark.student_id}-${mark.exam_id}`;
          const existing = grouped.get(key) || {
            student_name: mark.student_name,
            reg_no: mark.reg_no,
            class_name: selectedExamForResults?.class_name || '',
            exam_name: mark.exam_name,
            subjects: {} as Record<string, string>,
          };

          existing.subjects[mark.subject_name] = String(mark.marks_obtained);
          grouped.set(key, existing);
          return grouped;
        }, new Map<string, any>()).values(),
      ) as any[]).map((row) => {
        const totalMarks = resultColumns.reduce((sum, column) => sum + Number(row.subjects[column.name] || 0), 0);
        const totalMaxMarks = resultColumns.reduce((sum, column) => sum + Number(column.max_marks || 0), 0);

        return {
          student_name: row.student_name,
          reg_no: row.reg_no,
          class_name: row.class_name,
          exam_name: row.exam_name,
          ...resultColumns.reduce<Record<string, string>>((acc, column) => {
            acc[column.name] = row.subjects[column.name] || '-';
            return acc;
          }, {}),
          total_marks: String(totalMarks),
          percentage: formatPercentage(totalMarks, totalMaxMarks),
        };
      }),
    [resultColumns, resultMarks, selectedExamForResults],
  );
  const subjectReportSubjects = subjectReportFilters.class_id
    ? subjects.filter((subject) => String(subject.class_id) === subjectReportFilters.class_id)
    : subjects;
  const subjectReportExams = subjectReportFilters.class_id
    ? exams.filter((exam) => String(exam.class_id) === subjectReportFilters.class_id)
    : exams;
  const examReportExams = examReportFilters.class_id
    ? exams.filter((exam) => String(exam.class_id) === examReportFilters.class_id)
    : exams;
  const reportStudentMatches = students.filter((student) => {
    if (!individualReportFilters.student_query.trim()) {
      return true;
    }

    const query = individualReportFilters.student_query.toLowerCase();
    return student.name.toLowerCase().includes(query) || student.reg_no.toLowerCase().includes(query);
  });
  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);

  const generateSubjectReport = () => {
    const filteredRows = marks
      .filter((mark) => {
        const exam = exams.find((item) => item.id === mark.exam_id);
        if (subjectReportFilters.class_id && String(exam?.class_id || '') !== subjectReportFilters.class_id) {
          return false;
        }
        if (subjectReportFilters.subject_id && String(mark.subject_id) !== subjectReportFilters.subject_id) {
          return false;
        }
        if (subjectReportFilters.exam_id && String(mark.exam_id) !== subjectReportFilters.exam_id) {
          return false;
        }
        return true;
      });

    const columns = Array.from(
      new Map(
        filteredRows.map((mark) => [String(mark.subject_name), { name: String(mark.subject_name), max_marks: Number(mark.max_marks) }]),
      ).values(),
    ) as Array<{ name: string; max_marks: number }>;
    const grouped = new Map<string, any>();
    filteredRows.forEach((mark) => {
      const exam = exams.find((item) => item.id === mark.exam_id);
      const key = `${mark.student_id}-${mark.exam_id}`;
      const existing = grouped.get(key) || {
        student_name: mark.student_name,
        reg_no: mark.reg_no,
        class_name: classMap.get(exam?.class_id) || '',
        exam_name: mark.exam_name,
        subjects: {} as Record<string, string>,
      };

      existing.subjects[mark.subject_name] = String(mark.marks_obtained);
      grouped.set(key, existing);
    });

    const rows = Array.from(grouped.values()).map((row) => {
      const totalMarks = columns.reduce((sum, column) => sum + Number(row.subjects[column.name] || 0), 0);
      const totalMaxMarks = columns.reduce((sum, column) => sum + Number(column.max_marks || 0), 0);

      return {
        student_name: row.student_name,
        reg_no: row.reg_no,
        class_name: row.class_name,
        exam_name: row.exam_name,
        ...columns.reduce<Record<string, string>>((acc, column) => {
          acc[column.name] = row.subjects[column.name] || '-';
          return acc;
        }, {}),
        total_marks: String(totalMarks),
        percentage: formatPercentage(totalMarks, totalMaxMarks),
      };
    });

    setSubjectReportColumns(columns);
    setSubjectReportData(rows);
    setActiveReportType('subject');
    setIsReportModalOpen(true);
  };

  const generateExamReport = () => {
    const filteredRows = marks
      .filter((mark) => {
        const exam = exams.find((item) => item.id === mark.exam_id);
        if (examReportFilters.class_id && String(exam?.class_id || '') !== examReportFilters.class_id) {
          return false;
        }
        if (examReportFilters.exam_id && String(mark.exam_id) !== examReportFilters.exam_id) {
          return false;
        }
        return true;
      });

    const columns = Array.from(
      new Map(
        filteredRows.map((mark) => [String(mark.subject_name), { name: String(mark.subject_name), max_marks: Number(mark.max_marks) }]),
      ).values(),
    ) as Array<{ name: string; max_marks: number }>;
    const grouped = new Map<string, any>();

    filteredRows.forEach((mark) => {
      const exam = exams.find((item) => item.id === mark.exam_id);
      const key = `${mark.student_id}-${mark.exam_id}`;
      const existing = grouped.get(key) || {
        student_name: mark.student_name,
        reg_no: mark.reg_no,
        class_name: classMap.get(exam?.class_id) || '',
        exam_name: mark.exam_name,
        subjects: {} as Record<string, string>,
      };

      existing.subjects[mark.subject_name] = String(mark.marks_obtained);
      grouped.set(key, existing);
    });

    const rows = Array.from(grouped.values()).map((row) => {
      const totalMarks = columns.reduce((sum, column) => sum + Number(row.subjects[column.name] || 0), 0);
      const totalMaxMarks = columns.reduce((sum, column) => sum + Number(column.max_marks || 0), 0);

      return {
        student_name: row.student_name,
        reg_no: row.reg_no,
        class_name: row.class_name,
        exam_name: row.exam_name,
        ...columns.reduce<Record<string, string>>((acc, column) => {
          acc[column.name] = row.subjects[column.name] || '-';
          return acc;
        }, {}),
        total_marks: String(totalMarks),
        percentage: formatPercentage(totalMarks, totalMaxMarks),
      };
    });

    setSubjectReportColumns(columns);
    setExamReportData(rows);
    setActiveReportType('exam');
    setIsReportModalOpen(true);
  };

  const generateIndividualReport = () => {
    const filteredRows = marks
      .filter((mark) => {
        if (individualReportFilters.student_id && String(mark.student_id) !== individualReportFilters.student_id) {
          return false;
        }
        if (individualReportFilters.exam_id && String(mark.exam_id) !== individualReportFilters.exam_id) {
          return false;
        }
        return true;
      });

    const columns = Array.from(
      new Map(
        filteredRows.map((mark) => [String(mark.subject_name), { name: String(mark.subject_name), max_marks: Number(mark.max_marks) }]),
      ).values(),
    ) as Array<{ name: string; max_marks: number }>;
    const grouped = new Map<string, any>();

    filteredRows.forEach((mark) => {
      const student = students.find((item) => item.id === mark.student_id);
      const key = `${mark.student_id}-${mark.exam_id}`;
      const existing = grouped.get(key) || {
        student_name: mark.student_name,
        reg_no: mark.reg_no,
        class_name: classMap.get(student?.class_id) || '',
        exam_name: mark.exam_name,
        subjects: {} as Record<string, string>,
      };

      existing.subjects[mark.subject_name] = String(mark.marks_obtained);
      grouped.set(key, existing);
    });

    const rows = Array.from(grouped.values()).map((row) => {
      const totalMarks = columns.reduce((sum, column) => sum + Number(row.subjects[column.name] || 0), 0);
      const totalMaxMarks = columns.reduce((sum, column) => sum + Number(column.max_marks || 0), 0);

      return {
        student_name: row.student_name,
        reg_no: row.reg_no,
        class_name: row.class_name,
        exam_name: row.exam_name,
        ...columns.reduce<Record<string, string>>((acc, column) => {
          acc[column.name] = row.subjects[column.name] || '-';
          return acc;
        }, {}),
        total_marks: String(totalMarks),
        percentage: formatPercentage(totalMarks, totalMaxMarks),
      };
    });

    setSubjectReportColumns(columns);
    setIndividualReportData(rows);
    setActiveReportType('individual');
    setIsReportModalOpen(true);
  };

  const activeReportRows =
    activeReportType === 'subject'
      ? subjectReportData
      : activeReportType === 'exam'
        ? examReportData
        : activeReportType === 'individual'
          ? individualReportData
          : [];

  useEffect(() => {
    if (selectedExam?.full_marks && filteredSubjects.length > 0) {
      const nextMarks = filteredSubjects.reduce<Record<number, { marks_obtained: string; max_marks: string }>>((acc, subject) => {
        acc[subject.id] = {
          marks_obtained: subjectMarks[subject.id]?.marks_obtained || '',
          max_marks: subjectMarks[subject.id]?.max_marks || String(selectedExam.full_marks),
        };
        return acc;
      }, {});

      setSubjectMarks(nextMarks);
    }
  }, [selectedExam, filteredSubjects]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examination Management</h1>
          <p className="text-slate-500">Schedule exams and manage student marks.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsExamModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Exam
          </button>
          <button 
            onClick={() => setIsMarkModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-200"
          >
            <Award className="w-5 h-5" />
            Enter Marks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exams.length === 0 ? (
          <div className="col-span-full bg-white p-12 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Exams Scheduled</h3>
            <p className="text-slate-500 max-w-xs">Start by creating a new examination schedule for your classes.</p>
          </div>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase">
                  {exam.class_name}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{exam.name}</h3>
              <p className="text-sm text-slate-500 mt-1">Date: {exam.date}</p>
              <p className="text-sm text-slate-500 mt-1">Full Mark: {exam.full_marks || 100}</p>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      U{i}
                    </div>
                  ))}
                </div>
                <button onClick={() => handleViewResults(exam)} className="text-indigo-600 text-sm font-bold hover:underline">View Results</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subject Master */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Subject Master</h3>
          <button onClick={() => setIsSubjectModalOpen(true)} className="text-indigo-600 text-sm font-bold hover:underline flex items-center gap-1">
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {subjects.length === 0 ? (
               <p className="col-span-full text-slate-400 text-sm italic">No subjects added yet.</p>
            ) : (
              subjects.map(sub => (
                <div key={sub.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
                  <p className="text-sm font-semibold text-slate-700">{sub.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{sub.class_name}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Exam Reports</h2>
          <p className="text-slate-500">Generate subject wise, exam wise and individual student reports.</p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
              <BookOpen className="h-5 w-5" />
              <h3 className="font-bold">Subject Wise Report</h3>
            </div>
            <div className="space-y-4 p-6">
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={subjectReportFilters.class_id} onChange={(e) => setSubjectReportFilters({ class_id: e.target.value, subject_id: '', exam_id: '' })}>
                <option value="">All Classes</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={subjectReportFilters.subject_id} onChange={(e) => setSubjectReportFilters({ ...subjectReportFilters, subject_id: e.target.value })}>
                <option value="">All Subjects</option>
                {subjectReportSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={subjectReportFilters.exam_id} onChange={(e) => setSubjectReportFilters({ ...subjectReportFilters, exam_id: e.target.value })}>
                <option value="">All Exams</option>
                {subjectReportExams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={generateSubjectReport} className="flex-1 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 font-bold text-white shadow-lg shadow-indigo-200">Generate</button>
                <button onClick={() => downloadExcelFile(subjectReportData, 'subject-wise-report')} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Download className="h-4 w-4" /></button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
              <ClipboardList className="h-5 w-5" />
              <h3 className="font-bold">Exam Report</h3>
            </div>
            <div className="space-y-4 p-6">
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={examReportFilters.class_id} onChange={(e) => setExamReportFilters({ class_id: e.target.value, exam_id: '' })}>
                <option value="">All Classes</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={examReportFilters.exam_id} onChange={(e) => setExamReportFilters({ ...examReportFilters, exam_id: e.target.value })}>
                <option value="">All Exams</option>
                {examReportExams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={generateExamReport} className="flex-1 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 font-bold text-white shadow-lg shadow-indigo-200">Generate</button>
                <button onClick={() => downloadExcelFile(examReportData, 'exam-report')} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Download className="h-4 w-4" /></button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4 text-white">
              <UserRound className="h-5 w-5" />
              <h3 className="font-bold">Individual Report</h3>
            </div>
            <div className="space-y-4 p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input className="w-full rounded-xl bg-slate-50 py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500" value={individualReportFilters.student_query} onChange={(e) => setIndividualReportFilters({ student_query: e.target.value, student_id: '', exam_id: individualReportFilters.exam_id })} placeholder="Student name or reg no" />
                {individualReportFilters.student_query.trim() && individualReportFilters.student_id === '' && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {reportStudentMatches.length > 0 ? reportStudentMatches.map((student) => (
                      <button key={student.id} type="button" onClick={() => setIndividualReportFilters({ ...individualReportFilters, student_id: String(student.id), student_query: `${student.name} (${student.reg_no})` })} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
                        <span className="font-medium text-slate-900">{student.name}</span>
                        <span className="text-sm text-slate-500">{student.reg_no}</span>
                      </button>
                    )) : <div className="px-4 py-3 text-sm text-slate-500">No matching students found</div>}
                  </div>
                )}
              </div>
              <select className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" value={individualReportFilters.exam_id} onChange={(e) => setIndividualReportFilters({ ...individualReportFilters, exam_id: e.target.value })}>
                <option value="">All Exams</option>
                {exams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={generateIndividualReport} className="flex-1 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-4 py-3 font-bold text-white shadow-lg shadow-indigo-200">Generate</button>
                <button onClick={() => downloadExcelFile(individualReportData, 'individual-report')} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Download className="h-4 w-4" /></button>
              </div>
            </div>
          </section>
        </div>

      </div>

      {/* Create Exam Modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Create New Exam</h3>
              <button onClick={() => setIsExamModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Exam Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={examForm.name}
                  onChange={(e) => setExamForm({...examForm, name: e.target.value})}
                  placeholder="e.g. Mid-Term Examination"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Exam Date</label>
                <input 
                  required
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={examForm.date}
                  onChange={(e) => setExamForm({...examForm, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Class</label>
                <select 
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={examForm.class_id}
                  onChange={(e) => setExamForm({...examForm, class_id: e.target.value})}
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Full Mark</label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={examForm.full_marks}
                  onChange={(e) => setExamForm({ ...examForm, full_marks: e.target.value })}
                  placeholder="100"
                />
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Create Exam
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Enter Marks Modal */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-2">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Enter Student Marks</h3>
              <button onClick={() => setIsMarkModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEnterMarks} className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Select Class</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={markForm.class_id}
                    onChange={(e) => setMarkForm({ class_id: e.target.value, exam_id: '', student_id: '' })}
                  >
                    <option value="">Choose Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Select Exam</label>
                  <select 
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={markForm.exam_id}
                    onChange={(e) => setMarkForm({ ...markForm, exam_id: e.target.value })}
                    disabled={!markForm.class_id}
                  >
                    <option value="">Choose Exam</option>
                    {filteredExams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.class_name})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2 relative">
                  <label className="text-sm font-semibold text-slate-700">Search Student Name or ID</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setMarkForm((current) => ({ ...current, student_id: '' }));
                    }}
                    placeholder="Type student name or registration no"
                    disabled={!markForm.class_id}
                  />
                  {markForm.class_id && studentSearch.trim() && markForm.student_id === '' && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {matchingStudents.length > 0 ? (
                        matchingStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              setMarkForm({ ...markForm, student_id: String(student.id) });
                              setStudentSearch(`${student.name} (${student.reg_no})`);
                            }}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-900">{student.name}</span>
                            <span className="text-sm text-slate-500">{student.reg_no}</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500">No matching students found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Subjects for Selected Class</h4>
                  <p className="text-xs text-slate-500">All class subjects appear together once class and exam are selected.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {filteredSubjects.map((subject) => (
                    <div key={subject.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{subject.name}</div>
                        <div className="text-xs text-slate-500">{subject.class_name}</div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Marks Obtained</label>
                          <input
                            type="number"
                            step="0.1"
                            className="w-full rounded-xl border-none bg-white px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                            value={subjectMarks[subject.id]?.marks_obtained || ''}
                            onChange={(e) =>
                              setSubjectMarks((current) => ({
                                ...current,
                                [subject.id]: {
                                  marks_obtained: e.target.value,
                                  max_marks: current[subject.id]?.max_marks || String(selectedExam?.full_marks || 100),
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Max Marks</label>
                          <input
                            type="number"
                            className="w-full rounded-xl border-none bg-white px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                            value={subjectMarks[subject.id]?.max_marks || String(selectedExam?.full_marks || 100)}
                            onChange={(e) =>
                              setSubjectMarks((current) => ({
                                ...current,
                                [subject.id]: {
                                  marks_obtained: current[subject.id]?.marks_obtained || '',
                                  max_marks: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Save Marks
              </button>
            </form>
          </div>
        </div>
      )}

      {isSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Add Subject</h3>
              <button onClick={() => setIsSubjectModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Subject Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="e.g. Physics"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Class</label>
                <select
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={subjectForm.class_id}
                  onChange={(e) => setSubjectForm({ ...subjectForm, class_id: e.target.value })}
                >
                  <option value="">Select Class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Save Subject
              </button>
            </form>
          </div>
        </div>
      )}

      {isResultModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Exam Results</h3>
                <p className="text-sm text-slate-500">{selectedExamForResults?.name} {selectedExamForResults?.class_name ? `• ${selectedExamForResults.class_name}` : ''}</p>
              </div>
              <button onClick={() => setIsResultModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {resultRows.length === 0 ? (
                <div className="p-10 text-center text-slate-500">No marks entered for this exam yet.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Student</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Reg No</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Exam</th>
                      {resultColumns.map((column) => (
                        <th key={column.name} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {column.name} ({column.max_marks})
                        </th>
                      ))}
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Total Marks</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultRows.map((row, index) => (
                      <tr key={`${row.reg_no}-${row.exam_name}-${index}`} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.student_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.reg_no}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.class_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.exam_name}</td>
                        {resultColumns.map((column) => (
                          <td key={column.name} className="px-6 py-4 text-sm text-slate-600">{(row as Record<string, string>)[column.name] || '-'}</td>
                        ))}
                        <td className="px-6 py-4 text-sm text-slate-600">{row.total_marks}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.percentage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 backdrop-blur-md p-4">
          <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-8 py-5">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {activeReportType === 'subject' ? 'Subject Wise Report' : activeReportType === 'exam' ? 'Exam Report' : 'Individual Report'}
                </h3>
                <p className="text-sm text-indigo-100">{activeReportRows.length} records</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => downloadExcelFile(activeReportRows, `${activeReportType || 'report'}-report`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Download size={16} />
                  Excel
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[calc(88vh-88px)] overflow-auto">
              {activeReportRows.length === 0 ? (
                <div className="px-8 py-16 text-center">
                  <h4 className="text-lg font-semibold text-slate-900">No results found</h4>
                  <p className="mt-2 text-sm text-slate-500">Try changing the filters and generate the report again.</p>
                </div>
              ) : activeReportType === 'individual' ? (
                <div className="space-y-6 p-8">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Student</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{activeReportRows[0]?.student_name || '--'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Reg No</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{activeReportRows[0]?.reg_no || '--'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Class</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{activeReportRows[0]?.class_name || '--'}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-400">Reports</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">{activeReportRows.length}</div>
                      </div>
                    </div>
                  </div>

                  {activeReportRows.map((row, index) => (
                    <section key={`${row.reg_no}-${row.exam_name}-${index}`} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                        <h4 className="text-base font-bold text-slate-900">{row.exam_name}</h4>
                        <p className="mt-1 text-sm text-slate-500">Total Marks: {row.total_marks} | Percentage: {row.percentage}</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-slate-100">
                              {subjectReportColumns.map((column) => (
                                <th key={column.name} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                  {column.name} ({column.max_marks})
                                </th>
                              ))}
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Total Marks</th>
                              <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Percentage</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {subjectReportColumns.map((column) => (
                                <td key={column.name} className="px-6 py-4 text-sm text-slate-600">{(row as Record<string, string>)[column.name] || '-'}</td>
                              ))}
                              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.total_marks}</td>
                              <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.percentage}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Student</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Reg No</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Class</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Exam</th>
                      {subjectReportColumns.map((column) => (
                        <th key={column.name} className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {column.name} ({column.max_marks})
                        </th>
                      ))}
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Total Marks</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeReportRows.map((row, index) => (
                      <tr key={`${row.reg_no}-${row.exam_name}-${index}`} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{row.student_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.reg_no}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.class_name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.exam_name}</td>
                        {subjectReportColumns.map((column) => (
                          <td key={column.name} className="px-6 py-4 text-sm text-slate-600">{(row as Record<string, string>)[column.name] || '-'}</td>
                        ))}
                        <td className="px-6 py-4 text-sm text-slate-600">{row.total_marks}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{row.percentage}</td>
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
