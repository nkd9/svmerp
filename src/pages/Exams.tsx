import React, { useMemo, useState, useEffect } from 'react';
import { Plus, BookOpen, Award, FileText, X, Download, Search, UserRound, ClipboardList, Eye, Pencil, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { printReport } from '../utils/print';
import {
  Button,
  EmptyTableRow,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui';

const formatPercentage = (obtained: number, max: number) => {
  if (!max) {
    return '0%';
  }

  return `${((obtained / max) * 100).toFixed(1)}%`;
};

const getExamTotalMaxMarks = (exam: any) => {
  const subjectMaxMarks = Array.isArray(exam?.subject_max_marks) ? exam.subject_max_marks : [];
  const total = subjectMaxMarks.reduce((sum: number, item: any) => sum + Number(item?.max_marks || 0), 0);
  return total > 0 ? total : 100;
};

const formatMarkValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') {
    return 'NA';
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
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
  const [isEditExamModalOpen, setIsEditExamModalOpen] = useState(false);
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedExamForResults, setSelectedExamForResults] = useState<any | null>(null);
  const [selectedExamForEdit, setSelectedExamForEdit] = useState<any | null>(null);
  const [examListClassId, setExamListClassId] = useState('');
  
  const [examForm, setExamForm] = useState<{
    name: string;
    date: string;
    class_id: string;
    subject_max_marks: { subject_id: number; max_marks: number }[];
  }>({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', subject_max_marks: [] });
  const [markForm, setMarkForm] = useState({ class_id: '', student_id: '', exam_id: '' });
  const [studentSearch, setStudentSearch] = useState('');
  const [subjectMarks, setSubjectMarks] = useState<Record<number, { marks_obtained: string; max_marks: string }>>({});
  const [subjectReportFilters, setSubjectReportFilters] = useState({ class_id: '', subject_id: '', exam_id: '' });
  const [examReportFilters, setExamReportFilters] = useState({ class_id: '', exam_id: '' });
  const [individualReportFilters, setIndividualReportFilters] = useState({ student_query: '', student_id: '', exam_id: '' });
  const [subjectReportData, setSubjectReportData] = useState<any[]>([]);
  const [subjectReportColumns, setSubjectReportColumns] = useState<Array<{ name: string; max_marks: number }>>([]);
  const [examReportData, setExamReportData] = useState<any[]>([]);
  const [individualReportData, setIndividualReportData] = useState<any[]>([]);
  const [individualReportCard, setIndividualReportCard] = useState<any | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportType, setActiveReportType] = useState<'subject' | 'exam' | 'individual' | null>(null);
  const [marksTableClassId, setMarksTableClassId] = useState('');
  const [marksTableExamId, setMarksTableExamId] = useState('');
  const [marksTableCurrentPage, setMarksTableCurrentPage] = useState(1);
  const [marksTablePageSize, setMarksTablePageSize] = useState<'5' | '10' | '20' | 'all'>('10');
  const [selectedStudentForMarksView, setSelectedStudentForMarksView] = useState<any | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [examsRes, classesRes, subjectsRes, studentsRes, marksRes] = await Promise.all([
      fetch('/api/exams', { headers }),
      fetch('/api/classes', { headers }),
      fetch('/api/subjects', { headers }),
      fetch('/api/students?status=active&limit=500', { headers }),
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
      setExamForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', subject_max_marks: [] });
    }
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForEdit) return;

    const res = await fetch(`/api/exams/${selectedExamForEdit.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(examForm)
    });

    if (res.ok) {
      setIsEditExamModalOpen(false);
      fetchData();
      setExamForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', subject_max_marks: [] });
      setSelectedExamForEdit(null);
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to update exam');
    }
  };

  const handleDeleteExam = async (exam: any) => {
    if (!window.confirm(`Are you sure you want to delete the exam "${exam.name}"? This will also delete all marks associated with this exam.`)) {
      return;
    }

    const res = await fetch(`/api/exams/${exam.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (res.ok) {
      fetchData();
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to delete exam');
    }
  };

  const openEditExamModal = (exam: any) => {
    setSelectedExamForEdit(exam);
    setExamForm({
      name: exam.name || '',
      date: exam.date || format(new Date(), 'yyyy-MM-dd'),
      class_id: String(exam.class_id || ''),
      subject_max_marks: exam.subject_max_marks || []
    });
    setIsEditExamModalOpen(true);
  };


  const handleEnterMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    const marksPayload = filteredSubjects
      .map((subject) => ({
        student_id: Number(markForm.student_id),
        exam_id: Number(markForm.exam_id),
        subject_id: subject.id,
        marks_obtained: Number(subjectMarks[subject.id]?.marks_obtained || 0),
        max_marks: Number(subjectMarks[subject.id]?.max_marks || getSubjectMaxMarks(subject.id)),
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
  const selectedExam = useMemo(() => {
    return exams.find((e) => String(e.id) === markForm.exam_id);
  }, [markForm.exam_id, exams]);

  const filteredExams = useMemo(
    () => (selectedClassId ? exams.filter((exam) => exam.class_id === selectedClassId) : []),
    [exams, selectedClassId],
  );
  
  const filteredSubjects = useMemo(() => {
    if (!markForm.class_id) return [];
    return subjects.filter((s) => String(s.class_id) === markForm.class_id);
  }, [markForm.class_id, subjects]);

  const getSubjectMaxMarks = (subjectId: number) => {
    if (!selectedExam || !selectedExam.subject_max_marks) return 100;
    const found = selectedExam.subject_max_marks.find((sm: any) => sm.subject_id === subjectId);
      return found ? found.max_marks : getExamTotalMaxMarks(selectedExam);
  };

  const filteredStudents = useMemo(
    () => (selectedClassId ? students.filter((student) => student.class_id === selectedClassId) : []),
    [students, selectedClassId],
  );
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

  const examListExams = useMemo(() => {
    if (!examListClassId) return exams;
    return exams.filter((exam) => String(exam.class_id) === examListClassId);
  }, [exams, examListClassId]);

  const examFormSubjects = useMemo(() => {
    if (!examForm.class_id) return [];
    return subjects.filter((s) => String(s.class_id) === String(examForm.class_id));
  }, [subjects, examForm.class_id]);

  useEffect(() => {
    // When class changes in exam form, initialize subject_max_marks
    if (examForm.class_id) {
       // Only initialized if it's empty, or if we switched classes entirely
       const hasExistingForClass = examForm.subject_max_marks.length > 0 && 
           examFormSubjects.some(s => examForm.subject_max_marks.some(sm => sm.subject_id === s.id));
           
       if (!hasExistingForClass) {
           setExamForm(prev => ({
             ...prev,
             subject_max_marks: examFormSubjects.map(s => ({
               subject_id: s.id,
               max_marks: 100 // default max marks
             }))
           }));
       }
    }
  }, [examForm.class_id, examFormSubjects]);

  const marksTableExams = marksTableClassId
    ? exams.filter((exam) => String(exam.class_id) === marksTableClassId)
    : [];
  const marksTableStudents = marksTableClassId
    ? students.filter((student) => String(student.class_id) === marksTableClassId)
    : [];
  const marksTableFilteredRows = marks.filter((mark) => {
    if (marksTableClassId) {
      const student = students.find((item) => item.id === mark.student_id);
      if (String(student?.class_id || '') !== marksTableClassId) {
        return false;
      }
    }
    if (marksTableExamId && String(mark.exam_id) !== marksTableExamId) {
      return false;
    }
    return true;
  });
  const marksTableColumns = useMemo(
    () => {
      if (!marksTableExamId) return [];
      return Array.from(
        new Map(
          marksTableFilteredRows.map((mark) => [
            String(mark.subject_name),
            { name: String(mark.subject_name), max_marks: Number(mark.max_marks) },
          ]),
        ).values(),
      ) as Array<{ name: string; max_marks: number }>;
    },
    [marksTableFilteredRows, marksTableExamId],
  );
  const marksTableRows = useMemo(
    () => {
      if (!marksTableExamId) return [];
      return marksTableStudents.map((student) => {
        const studentExamMarks = marksTableFilteredRows.filter((mark) => mark.student_id === student.id);
        const subjectsMap = studentExamMarks.reduce<Record<string, string>>((acc, mark) => {
          acc[mark.subject_name] = String(mark.marks_obtained);
          return acc;
        }, {});
        const totalMarks = marksTableColumns.reduce((sum, column) => sum + Number(subjectsMap[column.name] || 0), 0);
        const totalMaxMarks = marksTableColumns.reduce((sum, column) => sum + Number(column.max_marks || 0), 0);

        return {
          id: student.id,
          reg_no: student.reg_no,
          student_name: student.name,
          class_name: student.class_name,
          hasMarks: studentExamMarks.length > 0,
          examId: marksTableExamId ? Number(marksTableExamId) : null,
          subjects: marksTableColumns.reduce<Record<string, string>>((acc, column) => {
            acc[column.name] = subjectsMap[column.name] || '-';
            return acc;
          }, {}),
          total_marks: studentExamMarks.length > 0 ? String(totalMarks) : '-',
          percentage: studentExamMarks.length > 0 ? formatPercentage(totalMarks, totalMaxMarks) : '-',
        };
      });
    },
    [marksTableStudents, marksTableFilteredRows, marksTableColumns, marksTableExamId],
  );

  const paginatedMarksTableRows = useMemo(() => {
    if (marksTablePageSize === 'all') return marksTableRows;
    const size = Number(marksTablePageSize);
    const startIndex = (marksTableCurrentPage - 1) * size;
    return marksTableRows.slice(startIndex, startIndex + size);
  }, [marksTableRows, marksTableCurrentPage, marksTablePageSize]);

  const marksTableTotalPages = marksTablePageSize === 'all' ? 1 : Math.ceil(marksTableRows.length / Number(marksTablePageSize));
  const selectedStudentMarksRows = useMemo(() => {
    if (!selectedStudentForMarksView) {
      return [];
    }

    const filteredRows = marks.filter((mark) => mark.student_id === selectedStudentForMarksView.id);
    const grouped = new Map<string, any>();

    filteredRows.forEach((mark) => {
      const exam = exams.find((item) => item.id === mark.exam_id);
      const key = `${mark.student_id}-${mark.exam_id}`;
      const existing = grouped.get(key) || {
        exam_name: mark.exam_name,
        exam_date: exam?.date || '',
        subjects: {} as Record<string, string>,
      };
      existing.subjects[mark.subject_name] = `${mark.marks_obtained}/${mark.max_marks}`;
      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => String(b.exam_date || '').localeCompare(String(a.exam_date || '')));
  }, [selectedStudentForMarksView, marks, exams]);
  const selectedStudentMarksColumns = useMemo(
    () =>
      Array.from(
        new Set(
          selectedStudentMarksRows.flatMap((row) => Object.keys(row.subjects || {})),
        ),
      ),
    [selectedStudentMarksRows],
  );

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
    const selectedStudent = students.find((item) => String(item.id) === individualReportFilters.student_id) || null;
    if (!selectedStudent) {
      alert('Please select a student');
      return;
    }
    if (filteredRows.length === 0) {
      setIndividualReportCard(null);
      setIndividualReportData([]);
      setActiveReportType('individual');
      setIsReportModalOpen(true);
      return;
    }

    const examOrder = exams
      .filter((exam) =>
        filteredRows.some((mark) => Number(mark.exam_id) === Number(exam.id)) &&
        (!individualReportFilters.exam_id || String(exam.id) === individualReportFilters.exam_id),
      )
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || Number(a.id) - Number(b.id));

    const subjectMap = new Map<string, { subject_name: string; values: Record<number, { full_marks: number | null; marks_obtained: number | null }> }>();
    filteredRows.forEach((mark) => {
      const key = String(mark.subject_name);
      const existing = subjectMap.get(key) || { subject_name: key, values: {} };
      existing.values[Number(mark.exam_id)] = {
        full_marks: Number(mark.max_marks || 0),
        marks_obtained: Number(mark.marks_obtained || 0),
      };
      subjectMap.set(key, existing);
    });

    const subjectRows = Array.from(subjectMap.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    const totals = examOrder.map((exam) => {
      const examMarks = filteredRows.filter((mark) => Number(mark.exam_id) === Number(exam.id));
      return {
        exam_id: Number(exam.id),
        full_marks: examMarks.reduce((sum, mark) => sum + Number(mark.max_marks || 0), 0),
        marks_obtained: examMarks.reduce((sum, mark) => sum + Number(mark.marks_obtained || 0), 0),
      };
    });

    setIndividualReportCard({
      student_name: selectedStudent.name || '',
      father_name: selectedStudent.father_name || '',
      mother_name: selectedStudent.mother_name || '',
      roll_no: selectedStudent.roll_no || selectedStudent.reg_no || '',
      reg_no: selectedStudent.reg_no || '',
      class_name: selectedStudent.class_name || classMap.get(selectedStudent.class_id) || '',
      exams: examOrder.map((exam) => ({
        exam_id: Number(exam.id),
        exam_name: exam.name,
        exam_date: exam.date,
      })),
      subjects: subjectRows,
      totals,
    });
    setIndividualReportData(
      subjectRows.map((row) => {
        const base: Record<string, string> = { Subject: row.subject_name };
        examOrder.forEach((exam) => {
          const value = row.values[Number(exam.id)];
          base[`${exam.name} Full Mark`] = formatMarkValue(value?.full_marks);
          base[`${exam.name} Appeared Mark`] = formatMarkValue(value?.marks_obtained);
        });
        return base;
      }),
    );
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
    if (!selectedExam || filteredSubjects.length === 0) {
      return;
    }

    const existingMarks = marks.filter(
      (mark) => String(mark.student_id) === markForm.student_id && String(mark.exam_id) === markForm.exam_id,
    );

    const nextMarks = filteredSubjects.reduce<Record<number, { marks_obtained: string; max_marks: string }>>((acc, subject) => {
      const existingMark = existingMarks.find((mark) => mark.subject_id === subject.id);
      acc[subject.id] = {
        marks_obtained: existingMark ? String(existingMark.marks_obtained) : '',
        max_marks: existingMark ? String(existingMark.max_marks) : String(getSubjectMaxMarks(subject.id)),
      };
      return acc;
    }, {});

    setSubjectMarks((current) => {
      const hasChanged =
        Object.keys(nextMarks).length !== Object.keys(current).length ||
        Object.entries(nextMarks).some(
          ([subjectId, value]) => {
            const marksValue = value as { marks_obtained: string; max_marks: string };
            return (
              current[Number(subjectId)]?.marks_obtained !== marksValue.marks_obtained ||
              current[Number(subjectId)]?.max_marks !== marksValue.max_marks
            );
          },
        );

      return hasChanged ? nextMarks : current;
    });
  }, [selectedExam, filteredSubjects, marks, markForm.student_id, markForm.exam_id]);

  const handleEditStudentMarks = (student: any) => {
    setMarkForm({
      class_id: String(student.class_id),
      student_id: String(student.id),
      exam_id: marksTableExamId || '',
    });
    setStudentSearch(`${student.name} (${student.reg_no})`);
    setIsMarkModalOpen(true);
  };

  const printIndividualReportCard = () => {
    if (!individualReportCard) {
      alert('No individual report to print');
      return;
    }

    const examHeader = individualReportCard.exams
      .map((exam: any) => `<th colspan="2">${String(exam.exam_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</th>`)
      .join('');
    const examSubHeader = individualReportCard.exams.map(() => '<th>FULL MARK</th><th>APPERED MARK</th>').join('');
    const subjectRows = individualReportCard.subjects
      .map((subject: any) => {
        const cells = individualReportCard.exams
          .map((exam: any) => {
            const value = subject.values?.[Number(exam.exam_id)];
            return `<td>${formatMarkValue(value?.full_marks)}</td><td>${formatMarkValue(value?.marks_obtained)}</td>`;
          })
          .join('');
        return `<tr><td class="subject">${String(subject.subject_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>${cells}</tr>`;
      })
      .join('');
    const totalCells = individualReportCard.totals
      .map((total: any) => `<td>${formatMarkValue(total.full_marks)}</td><td>${formatMarkValue(total.marks_obtained)}</td>`)
      .join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Please allow pop-ups for printing');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Individual Report - ${individualReportCard.student_name}</title>
          <style>
            @page { margin: 10mm; size: A4 portrait; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #111; }
            .card { border: 1px solid #111; padding: 12px; margin-bottom: 16px; }
            .header { display: grid; grid-template-columns: 76px 1fr; gap: 10px; align-items: center; margin-bottom: 10px; }
            .logo { border: 1px solid #111; height: 64px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
            .school-box { border: 1px solid #111; text-align: center; padding: 8px 10px; }
            .school-title { font-size: 22px; font-weight: 700; letter-spacing: 0.3px; }
            .school-subtitle { font-size: 15px; margin-top: 4px; }
            .meta { display: grid; grid-template-columns: 180px 1fr; row-gap: 4px; column-gap: 10px; font-size: 14px; margin: 10px 0 14px; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #111; padding: 6px 4px; text-align: center; font-size: 13px; }
            th { font-weight: 700; }
            th.subject, td.subject { text-align: left; width: 150px; }
            .totals td { font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo">SVM</div>
              <div class="school-box">
                <div class="school-title">SVM CLASSES, DIGAPAHANDI</div>
                <div class="school-subtitle">SSVM ABASIKA HIGHER SECONDARY SCHOOL</div>
              </div>
            </div>
            <div class="meta">
              <div>NAME:-</div><div>${String(individualReportCard.student_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div>FATHER'S NAME:-</div><div>${String(individualReportCard.father_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div>MOTHER'S NAME:-</div><div>${String(individualReportCard.mother_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              <div>ROLL NO:-</div><div>${String(individualReportCard.roll_no || individualReportCard.reg_no || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="subject" rowspan="2">SUBJECT</th>
                  ${examHeader}
                </tr>
                <tr>
                  ${examSubHeader}
                </tr>
              </thead>
              <tbody>
                ${subjectRows}
                <tr class="totals">
                  <td class="subject">TOTAL</td>
                  ${totalCells}
                </tr>
              </tbody>
            </table>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Examination Management</h1>
          <p className="text-slate-500">Schedule exams and manage student marks.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/exams/subjects"
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all"
          >
            <BookOpen className="w-5 h-5" />
            Subject Master
          </Link>
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

      <div id="exams-list" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Exams List</h3>
            <p className="text-sm text-slate-500">Manage all existing exams.</p>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-1">
            <select
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={examListClassId}
              onChange={(e) => setExamListClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6">
          {examListExams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {examListExams.map((exam) => (
                <div key={exam.id} className="relative bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl"></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1">{exam.name}</h4>
                      <div className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        {exam.class_name}
                      </div>
                    </div>
                    <div className="flex space-x-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditExamModal(exam)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Exam"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Exam"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-1">Exam Date</div>
                      <div className="text-sm font-semibold text-slate-700">{exam.date}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium mb-1">Full Marks</div>
                      <div className="text-sm font-semibold text-slate-700">{getExamTotalMaxMarks(exam)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewResults(exam)}
                    className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 rounded-xl text-sm font-semibold transition-colors border border-slate-200"
                  >
                    <Eye className="w-4 h-4" />
                    View Results
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="text-slate-500 font-medium">No exams found</div>
              <p className="text-sm text-slate-400 mt-1">Try changing the class filter or create a new exam.</p>
            </div>
          )}
        </div>
      </div>

      <div id="student-marks-table" className="scroll-mt-24 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Student Marks Table</h3>
            <p className="text-sm text-slate-500">Select class and exam to view all students with subject-wise marks.</p>
          </div>
          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <select
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={marksTableClassId}
              onChange={(e) => {
                setMarksTableClassId(e.target.value);
                setMarksTableExamId('');
              }}
            >
              <option value="">Select Class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select
              className="w-full rounded-xl bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
              value={marksTableExamId}
              onChange={(e) => setMarksTableExamId(e.target.value)}
              disabled={!marksTableClassId}
            >
              <option value="">Select Exam</option>
              {marksTableExams.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="w-full">
          <Table className="text-sm">
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell className="p-2">Reg No</TableHeaderCell>
                <TableHeaderCell className="p-2">Student</TableHeaderCell>
                <TableHeaderCell className="hidden p-2 lg:table-cell">Class</TableHeaderCell>
                {marksTableColumns.map((column) => (
                  <TableHeaderCell key={column.name} className="p-2 text-center leading-tight">
                    <div className="line-clamp-2" title={column.name}>{column.name}</div>
                    <div className="text-[10px] text-slate-400">({column.max_marks})</div>
                  </TableHeaderCell>
                ))}
                <TableHeaderCell className="p-2 text-center">Total</TableHeaderCell>
                <TableHeaderCell className="p-2 text-center">%</TableHeaderCell>
                <TableHeaderCell className="p-2 text-right">Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedMarksTableRows.map((student) => {
                return (
                  <TableRow key={student.id}>
                    <TableCell className="p-2">{student.reg_no}</TableCell>
                    <TableCell className="p-2 font-semibold text-slate-900">{student.student_name}</TableCell>
                    <TableCell className="hidden p-2 lg:table-cell">{student.class_name}</TableCell>
                    {marksTableColumns.map((column) => (
                      <TableCell key={column.name} className="p-2 text-center font-medium">
                        {student.subjects[column.name] || '-'}
                      </TableCell>
                    ))}
                    <TableCell className="p-2 text-center font-bold">{student.total_marks}</TableCell>
                    <TableCell className="p-2 text-center font-bold">{student.percentage}</TableCell>
                    <TableCell className="p-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled={!student.hasMarks}
                          onClick={() => setSelectedStudentForMarksView(
                            students.find((item) => item.id === student.id) || null,
                          )}
                          className="h-8 w-8"
                          title="View Marks"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => handleEditStudentMarks(student)}
                          className="h-8 w-8"
                          title="Edit Marks"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {marksTableClassId && marksTableStudents.length === 0 && (
                <EmptyTableRow colSpan={marksTableColumns.length + 6}>No students found in this class.</EmptyTableRow>
              )}
              {marksTableClassId && !marksTableExamId && (
                <EmptyTableRow colSpan={marksTableColumns.length + 6}>Select an exam to view the marks table.</EmptyTableRow>
              )}
              {!marksTableClassId && (
                <EmptyTableRow colSpan={marksTableColumns.length + 6}>Select a class and exam to view the student marks table.</EmptyTableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {marksTableClassId && marksTableExamId && marksTableRows.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 p-4 pb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Show</span>
              <select
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={marksTablePageSize}
                onChange={(e) => {
                  setMarksTablePageSize(e.target.value as any);
                  setMarksTableCurrentPage(1);
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="all">All</option>
              </select>
              <span className="text-sm text-slate-500">records</span>
            </div>
            
            {marksTableRows.length > (marksTablePageSize === 'all' ? Infinity : Number(marksTablePageSize)) && marksTableTotalPages > 1 && (
              <Pagination page={marksTableCurrentPage} totalPages={marksTableTotalPages} onPageChange={setMarksTableCurrentPage} />
            )}
          </div>
        )}
      </div>



      <div id="exam-reports" className="scroll-mt-24 space-y-6">
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
                <button onClick={() => printReport('Subject Wise Report', subjectReportData)} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Printer className="h-4 w-4" /></button>
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
                <button onClick={() => printReport('Exam Report', examReportData)} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Printer className="h-4 w-4" /></button>
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
                <button onClick={printIndividualReportCard} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Printer className="h-4 w-4" /></button>
                <button onClick={() => downloadExcelFile(individualReportData, 'individual-report')} className="rounded-xl border border-indigo-200 px-4 py-3 text-indigo-700"><Download className="h-4 w-4" /></button>
              </div>
            </div>
          </section>
        </div>

      </div>

      {/* Create Exam Modal */}
      {isExamModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Create New Exam</h3>
              <button onClick={() => setIsExamModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateExam} className="max-h-[calc(92vh-88px)] overflow-y-auto p-6 space-y-4">
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

              {examForm.class_id && examFormSubjects.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">Subject Max Marks</label>
                  <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                    {examFormSubjects.map(subject => {
                      const item = examForm.subject_max_marks.find(sm => sm.subject_id === subject.id);
                      return (
                        <div key={subject.id} className="space-y-1">
                          <label className="text-xs text-slate-500">{subject.name}</label>
                          <input
                            required
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                            value={item?.max_marks || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setExamForm(prev => {
                                const exists = prev.subject_max_marks.find(sm => sm.subject_id === subject.id);
                                if (exists) {
                                  return {
                                    ...prev,
                                    subject_max_marks: prev.subject_max_marks.map(sm => 
                                      sm.subject_id === subject.id ? { ...sm, max_marks: val } : sm
                                    )
                                  };
                                } else {
                                  return {
                                    ...prev,
                                    subject_max_marks: [...prev.subject_max_marks, { subject_id: subject.id, max_marks: val }]
                                  };
                                }
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-4">
                Create Exam
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Exam Modal */}
      {isEditExamModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Edit Exam</h3>
              <button 
                onClick={() => {
                  setIsEditExamModalOpen(false);
                  setSelectedExamForEdit(null);
                  setExamForm({ name: '', date: format(new Date(), 'yyyy-MM-dd'), class_id: '', subject_max_marks: [] });
                }} 
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateExam} className="max-h-[calc(92vh-88px)] overflow-y-auto p-6 space-y-4">
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

              {examForm.class_id && examFormSubjects.length > 0 && (
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-slate-700">Subject Max Marks</label>
                  <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2">
                    {examFormSubjects.map(subject => {
                      const item = examForm.subject_max_marks.find(sm => sm.subject_id === subject.id);
                      return (
                        <div key={subject.id} className="space-y-1">
                          <label className="text-xs text-slate-500">{subject.name}</label>
                          <input
                            required
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                            value={item?.max_marks || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setExamForm(prev => {
                                const exists = prev.subject_max_marks.find(sm => sm.subject_id === subject.id);
                                if (exists) {
                                  return {
                                    ...prev,
                                    subject_max_marks: prev.subject_max_marks.map(sm => 
                                      sm.subject_id === subject.id ? { ...sm, max_marks: val } : sm
                                    )
                                  };
                                } else {
                                  return {
                                    ...prev,
                                    subject_max_marks: [...prev.subject_max_marks, { subject_id: subject.id, max_marks: val }]
                                  };
                                }
                              });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 mt-4">
                Update Exam
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
                  {filteredSubjects.map((subject) => {
                    const maxMarks = getSubjectMaxMarks(subject.id);
                    return (
                    <div key={subject.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div>
                        <div className="font-semibold text-slate-900">{subject.name} <span className="text-xs text-indigo-600 font-bold ml-1">(Max: {maxMarks})</span></div>
                        <div className="text-xs text-slate-500">{subject.class_name}</div>
                      </div>
                      <div className="mt-3">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Marks Obtained</label>
                          <input
                            type="number"
                            step="0.1"
                            max={maxMarks}
                            className="w-full rounded-xl border-none bg-white px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                            value={subjectMarks[subject.id]?.marks_obtained || ''}
                            onChange={(e) =>
                              setSubjectMarks((current) => ({
                                ...current,
                                [subject.id]: {
                                  marks_obtained: e.target.value,
                                  max_marks: String(maxMarks),
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                Save Marks
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
                <Table>
                  <TableHead className="sticky top-0 bg-white">
                    <TableRow className="hover:bg-transparent">
                      <TableHeaderCell>Student</TableHeaderCell>
                      <TableHeaderCell>Reg No</TableHeaderCell>
                      <TableHeaderCell>Class</TableHeaderCell>
                      <TableHeaderCell>Exam</TableHeaderCell>
                      {resultColumns.map((column) => (
                        <TableHeaderCell key={column.name}>
                          {column.name} ({column.max_marks})
                        </TableHeaderCell>
                      ))}
                      <TableHeaderCell>Total Marks</TableHeaderCell>
                      <TableHeaderCell>Percentage</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resultRows.map((row, index) => (
                      <TableRow key={`${row.reg_no}-${row.exam_name}-${index}`}>
                        <TableCell className="font-medium text-slate-900">{row.student_name}</TableCell>
                        <TableCell>{row.reg_no}</TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell>{row.exam_name}</TableCell>
                        {resultColumns.map((column) => (
                          <TableCell key={column.name}>{(row as Record<string, string>)[column.name] || '-'}</TableCell>
                        ))}
                        <TableCell>{row.total_marks}</TableCell>
                        <TableCell>{row.percentage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedStudentForMarksView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[65] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Student Marks</h3>
                <p className="text-sm text-slate-500">
                  {selectedStudentForMarksView.name} • {selectedStudentForMarksView.reg_no} • {selectedStudentForMarksView.class_name}
                </p>
              </div>
              <button onClick={() => setSelectedStudentForMarksView(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto">
              {selectedStudentMarksRows.length === 0 ? (
                <div className="p-10 text-center text-slate-500">No marks entered for this student yet.</div>
              ) : (
                <Table>
                  <TableHead className="sticky top-0 bg-white">
                    <TableRow className="hover:bg-transparent">
                      <TableHeaderCell>Exam</TableHeaderCell>
                      <TableHeaderCell>Date</TableHeaderCell>
                      {selectedStudentMarksColumns.map((column) => (
                        <TableHeaderCell key={column}>
                          {column}
                        </TableHeaderCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedStudentMarksRows.map((row, index) => (
                      <TableRow key={`${row.exam_name}-${index}`}>
                        <TableCell className="font-semibold text-slate-900">{row.exam_name}</TableCell>
                        <TableCell>{row.exam_date || '-'}</TableCell>
                        {selectedStudentMarksColumns.map((column) => (
                          <TableCell key={column}>
                            {row.subjects?.[column] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                  onClick={() => activeReportType === 'individual' ? printIndividualReportCard() : printReport(`${activeReportType || 'report'}-report`.toUpperCase(), activeReportRows)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Printer size={16} />
                  Print
                </button>
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
                <div className="p-8">
                  {!individualReportCard ? (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-8 text-center text-slate-500">
                      No individual report found for the selected filters.
                    </div>
                  ) : (
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 p-6">
                        <div className="grid gap-4 md:grid-cols-[88px_1fr]">
                          <div className="flex h-20 items-center justify-center rounded-xl border border-slate-300 bg-slate-50 text-lg font-black text-slate-700">
                            SVM
                          </div>
                          <div className="rounded-xl border border-slate-300 px-6 py-4 text-center">
                            <div className="text-2xl font-black tracking-tight text-slate-900">SVM CLASSES, DIGAPAHANDI</div>
                            <div className="mt-1 text-sm font-semibold uppercase tracking-wide text-slate-600">SSVM ABASIKA HIGHER SECONDARY SCHOOL</div>
                          </div>
                        </div>
                        <div className="mt-5 grid gap-x-6 gap-y-2 text-sm md:grid-cols-[180px_1fr]">
                          <div className="font-semibold text-slate-700">NAME:-</div>
                          <div className="font-semibold text-slate-900">{individualReportCard.student_name || '--'}</div>
                          <div className="font-semibold text-slate-700">FATHER'S NAME:-</div>
                          <div className="font-semibold text-slate-900">{individualReportCard.father_name || '--'}</div>
                          <div className="font-semibold text-slate-700">MOTHER'S NAME:-</div>
                          <div className="font-semibold text-slate-900">{individualReportCard.mother_name || '--'}</div>
                          <div className="font-semibold text-slate-700">ROLL NO:-</div>
                          <div className="font-semibold text-slate-900">{individualReportCard.roll_no || individualReportCard.reg_no || '--'}</div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-50">
                              <th rowSpan={2} className="border border-slate-300 px-4 py-3 text-left text-sm font-bold text-slate-900">SUBJECT</th>
                              {individualReportCard.exams.map((exam: any) => (
                                <th key={exam.exam_id} colSpan={2} className="border border-slate-300 px-4 py-3 text-center text-sm font-bold text-slate-900">
                                  {exam.exam_name}
                                </th>
                              ))}
                            </tr>
                            <tr className="bg-slate-50">
                              {individualReportCard.exams.map((exam: any) => (
                                <React.Fragment key={`sub-${exam.exam_id}`}>
                                  <th className="border border-slate-300 px-3 py-2 text-center text-xs font-bold text-slate-700">FULL MARK</th>
                                  <th className="border border-slate-300 px-3 py-2 text-center text-xs font-bold text-slate-700">APPERED MARK</th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {individualReportCard.subjects.map((subject: any) => (
                              <tr key={subject.subject_name}>
                                <td className="border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900">{subject.subject_name}</td>
                                {individualReportCard.exams.map((exam: any) => {
                                  const value = subject.values?.[Number(exam.exam_id)];
                                  return (
                                    <React.Fragment key={`${subject.subject_name}-${exam.exam_id}`}>
                                      <td className="border border-slate-300 px-3 py-2 text-center text-sm text-slate-700">{formatMarkValue(value?.full_marks)}</td>
                                      <td className="border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-900">{formatMarkValue(value?.marks_obtained)}</td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ))}
                            <tr className="bg-slate-50">
                              <td className="border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                              {individualReportCard.totals.map((total: any) => (
                                <React.Fragment key={`total-${total.exam_id}`}>
                                  <td className="border border-slate-300 px-3 py-3 text-center text-sm font-bold text-slate-900">{formatMarkValue(total.full_marks)}</td>
                                  <td className="border border-slate-300 px-3 py-3 text-center text-sm font-bold text-slate-900">{formatMarkValue(total.marks_obtained)}</td>
                                </React.Fragment>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHead className="sticky top-0 bg-white">
                    <TableRow className="hover:bg-transparent">
                      <TableHeaderCell>Student</TableHeaderCell>
                      <TableHeaderCell>Reg No</TableHeaderCell>
                      <TableHeaderCell>Class</TableHeaderCell>
                      <TableHeaderCell>Exam</TableHeaderCell>
                      {subjectReportColumns.map((column) => (
                        <TableHeaderCell key={column.name}>
                          {column.name} ({column.max_marks})
                        </TableHeaderCell>
                      ))}
                      <TableHeaderCell>Total Marks</TableHeaderCell>
                      <TableHeaderCell>Percentage</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeReportRows.map((row, index) => (
                      <TableRow key={`${row.reg_no}-${row.exam_name}-${index}`}>
                        <TableCell className="font-medium text-slate-900">{row.student_name}</TableCell>
                        <TableCell>{row.reg_no}</TableCell>
                        <TableCell>{row.class_name}</TableCell>
                        <TableCell>{row.exam_name}</TableCell>
                        {subjectReportColumns.map((column) => (
                          <TableCell key={column.name}>{(row as Record<string, string>)[column.name] || '-'}</TableCell>
                        ))}
                        <TableCell>{row.total_marks}</TableCell>
                        <TableCell>{row.percentage}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
