import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, IndianRupee, Download, ArrowRight, Printer, AlertCircle, Ban, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import {
  Button,
  EmptyTableRow,
  Input,
  MessageDialog,
  Modal,
  PageHeader,
  Pagination,
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

const formatReceiptDateTime = (date: string) => {
  try {
    return format(new Date(date), 'yyyy-MM-dd, HH:mm:ss');
  } catch {
    return date;
  }
};

const getFeeSortTime = (fee: any) => {
  const parsed = new Date(fee.date || '').getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const OLD_DUE_LEDGER_TYPES = new Set(['Coaching Fee', 'Food Fee', 'Hostel Fee', 'Transport Fee', 'Old Due Collection']);
const AUTO_CURRENT_FEE_REFERENCE = 'Auto-created from student fee setup';

const getFeeCategory = (value?: string) => {
  const type = String(value || '').toLowerCase();
  if (type.includes('old due')) return 'old';
  if (type.includes('admission')) return 'admission';
  if (type.includes('coaching') || type.includes('tuition')) return 'coaching';
  if (type.includes('transport')) return 'transport';
  if (type.includes('entrance')) return 'entrance';
  if (type.includes('food')) return 'fooding';
  if (type.includes('hostel')) return 'hostel';
  return 'other';
};

const getAcademicSessionStartYear = (value?: string) => {
  const match = /^(\d{4})-(?:\d{2}|\d{4})$/.exec(String(value || '').trim());
  return match ? Number(match[1]) : 0;
};

const getCollegeYearRank = (className?: string) => {
  const normalized = String(className || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (/\b(XI|1ST YEAR|FIRST YEAR)\b/.test(normalized)) return 1;
  if (/\b(XII|2ND YEAR|SECOND YEAR)\b/.test(normalized)) return 2;
  return 0;
};

const getCollegeStreamName = (className?: string) => {
  const normalized = String(className || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (normalized.includes('ARTS')) return 'ARTS';
  if (normalized.includes('SC') || normalized.includes('SCIENCE')) return 'SCIENCE';
  return '';
};

const isOlderAcademicBucket = (fee: any, student: any) => {
  const feeYear = getAcademicSessionStartYear(fee?.academic_session);
  const studentYear = getAcademicSessionStartYear(student?.session);
  if (feeYear && studentYear && feeYear < studentYear) return true;
  if (feeYear && studentYear && feeYear > studentYear) return false;

  const feeRank = getCollegeYearRank(fee?.class_name);
  const studentRank = getCollegeYearRank(student?.class_name);
  const feeStream = getCollegeStreamName(fee?.class_name);
  const studentStream = getCollegeStreamName(student?.class_name);

  if (feeRank && studentRank) {
    if (feeStream && studentStream && feeStream === studentStream) return feeRank < studentRank;
    return feeRank < studentRank;
  }

  return false;
};

const getFeePaymentStage = (fee: any, student: any): 'old' | 'admission' | 'other' => {
  const category = getFeeCategory(fee?.type);
  if (category === 'old') return 'old';
  if (student && isOlderAcademicBucket(fee, student)) return 'old';

  const isLegacyOldDueLedger =
    OLD_DUE_LEDGER_TYPES.has(String(fee?.type || '')) &&
    String(fee?.reference_no || '') !== AUTO_CURRENT_FEE_REFERENCE;
  if (category !== 'admission' && isLegacyOldDueLedger) return 'old';
  if (category === 'admission') return 'admission';
  return 'other';
};

export default function Fees() {
  const { user } = useAuth();
  const location = useLocation();

  const [fees, setFees] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [ledgers, setLedgers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileStudent, setProfileStudent] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({ amount: '', admin_password: '' });
  const [notice, setNotice] = useState<{ title: string; message: string; tone?: 'success' | 'error' | 'info' } | null>(null);
  const [sensitiveAction, setSensitiveAction] = useState<{
    type: 'cancel' | 'delete';
    fee: any;
    reason: string;
    admin_password: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedPendingFeeId, setSelectedPendingFeeId] = useState('');
  const [selectedPendingFeeIds, setSelectedPendingFeeIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    student_id: '',
    amount: '',
    type: 'Admission Fee',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'paid',
    discount: '0',
    mode: 'Cash',
    reference_no: '',
    remark: '',
    bill_no: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'collect' && user?.role === 'admin') {
      setIsModalOpen(true);
    }
  }, [location.search, user?.role]);

  const fetchData = async () => {
    const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
    const [feesRes, studentsRes, ledgersRes] = await Promise.all([
      fetch('/api/fees', { headers }),
      fetch('/api/students', { headers }),
      fetch('/api/fee-ledgers', { headers })
    ]);
    const feesData = await feesRes.json();
    const studentsData = await studentsRes.json();
    setFees(feesData);
    setStudents(studentsData);
    if (ledgersRes.ok) {
      const ledgersData = await ledgersRes.json();
      setLedgers(ledgersData);
      if (ledgersData.length > 0) {
        setFormData(prev => ({ ...prev, type: ledgersData[0].name }));
      }
    }
    return { fees: feesData, students: studentsData };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin') {
      setNotice({ title: 'Admin Required', message: 'Only admin can modify financial information.', tone: 'error' });
      return;
    }
    const isOtherFeePayment = formData.type === 'Other Fee';
    const selectedPendingFees = fees.filter((fee) => selectedPendingFeeIds.includes(String(fee.id)));
    if (!isOtherFeePayment && selectedPendingFees.length === 0) {
      setNotice({ title: 'Select Pending Fee', message: 'Please select a pending fee row. Payments must be collected against the student fee setup.', tone: 'error' });
      return;
    }
    if (isOtherFeePayment && Number(formData.amount || 0) <= 0) {
      setNotice({ title: 'Enter Amount', message: 'Please enter other fee amount.', tone: 'error' });
      return;
    }
    if (isOtherFeePayment && !formData.remark.trim()) {
      setNotice({ title: 'Remark Required', message: 'Please enter a remark for other fee.', tone: 'error' });
      return;
    }
    const res = await fetch('/api/fees', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        ...formData,
        pending_fee_ids: selectedPendingFees.map((fee) => fee.id),
      })
    });
    if (res.ok) {
      const createdFee = await res.json();
      const printableFee = createdFee.fee || createdFee.fees?.[0] || {
        id: createdFee.id,
        student_id: Number(formData.student_id),
        student_name: selectedStudent?.name || '',
        amount: Number(formData.amount),
        type: formData.type,
        date: formData.date,
        status: formData.status,
        mode: formData.mode,
        reference_no: formData.reference_no,
        remark: formData.remark,
        bill_no: createdFee.fee?.bill_no || formData.bill_no,
      };

      handlePrintReceipt(printableFee);
      setIsModalOpen(false);
      fetchData();
      setStudentSearch('');
      setSelectedPendingFeeId('');
      setSelectedPendingFeeIds([]);
      setFormData({
        student_id: '', amount: '', type: ledgers[0]?.name || 'Admission Fee',
        date: format(new Date(), 'yyyy-MM-dd'), status: 'paid',
        discount: '0', mode: 'Cash', reference_no: '', remark: '',
        bill_no: ''
      });
    } else {
      const errorData = await res.json();
      setNotice({ title: 'Payment Blocked', message: errorData.error || 'Check failed. Payment could not be processed.', tone: 'error' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.role !== 'admin' || !editingFee) {
      setNotice({ title: 'Admin Required', message: 'Only admin can modify financial information.', tone: 'error' });
      return;
    }
    if (!editFormData.admin_password) {
      setNotice({ title: 'Password Required', message: 'Admin password is required.', tone: 'error' });
      return;
    }
    
    const res = await fetch(`/api/fees/${editingFee.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ amount: editFormData.amount, admin_password: editFormData.admin_password })
    });
    
    if (res.ok) {
      setIsEditModalOpen(false);
      setEditingFee(null);
      fetchData();
      setNotice({ title: 'Fee Updated', message: 'Fee updated successfully.', tone: 'success' });
    } else {
      const data = await res.json();
      setNotice({ title: 'Update Failed', message: data.error || 'Failed to update fee.', tone: 'error' });
    }
  };

  const openEditModal = (fee: any) => {
    setEditingFee(fee);
    setEditFormData({ amount: String(fee.amount), admin_password: '' });
    setIsEditModalOpen(true);
  };

  const handleCancelPayment = async (fee: any) => {
    if (user?.role !== 'admin') {
      setNotice({ title: 'Admin Required', message: 'Only admin can cancel payments.', tone: 'error' });
      return;
    }
    if (fee.status !== 'paid') {
      setNotice({ title: 'Cannot Cancel', message: 'Only paid receipts can be cancelled.', tone: 'error' });
      return;
    }
    setSensitiveAction({ type: 'cancel', fee, reason: '', admin_password: '' });
  };

  const handleDeletePayment = async (fee: any) => {
    if (user?.role !== 'admin') {
      setNotice({ title: 'Admin Required', message: 'Only admin can delete fee rows.', tone: 'error' });
      return;
    }
    if (fee.status === 'paid') {
      setNotice({ title: 'Cancel First', message: 'Cancel paid receipts before deleting them.', tone: 'error' });
      return;
    }
    setSensitiveAction({ type: 'delete', fee, reason: '', admin_password: '' });
  };

  const handleSensitiveActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sensitiveAction?.admin_password) {
      setNotice({ title: 'Password Required', message: 'Admin password is required.', tone: 'error' });
      return;
    }

    const isCancel = sensitiveAction.type === 'cancel';
    const res = await fetch(isCancel ? `/api/admin/fees/${sensitiveAction.fee.id}/cancel` : `/api/admin/fees/${sensitiveAction.fee.id}`, {
      method: isCancel ? 'POST' : 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        admin_password: sensitiveAction.admin_password,
        reason: sensitiveAction.reason,
      })
    });

    if (res.ok) {
      setSensitiveAction(null);
      fetchData();
      setNotice({
        title: isCancel ? 'Payment Cancelled' : 'Fee Row Deleted',
        message: isCancel ? 'Payment cancelled and due restored.' : 'Fee row deleted.',
        tone: 'success',
      });
    } else {
      const data = await res.json();
      setNotice({ title: isCancel ? 'Cancel Failed' : 'Delete Failed', message: data.error || (isCancel ? 'Failed to cancel payment.' : 'Failed to delete fee row.'), tone: 'error' });
    }
  };

  const filteredFees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = !query
      ? fees
      : fees.filter((fee) =>
          String(fee.bill_no || '').toLowerCase().includes(query) ||
          String(fee.student_name || '').toLowerCase().includes(query) ||
          String(fee.type || '').toLowerCase().includes(query) ||
          String(fee.status || '').toLowerCase().includes(query),
        );

    return [...rows].sort((a, b) => {
      const dateDiff = getFeeSortTime(b) - getFeeSortTime(a);
      if (dateDiff !== 0) return dateDiff;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [fees, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredFees.length / pageSize);
  const paginatedFees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFees.slice(start, start + pageSize);
  }, [filteredFees, currentPage]);

  const now = new Date();
  const totalCollected = fees
    .filter((fee) => {
      if (fee.status !== 'paid') return false;
      const feeDate = new Date(fee.date);
      return feeDate.getFullYear() === now.getFullYear() && feeDate.getMonth() === now.getMonth();
    })
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const pendingAmount = fees
    .filter((fee) => fee.status === 'pending')
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const todayCollection = fees
    .filter((fee) => fee.status === 'paid' && fee.date === format(new Date(), 'yyyy-MM-dd'))
    .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const selectedStudent = students.find((student) => String(student.id) === formData.student_id);
  const selectedStudentPendingFees = selectedStudent
    ? fees
        .filter((fee) => fee.student_id === selectedStudent.id && fee.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const selectedPendingFee = selectedStudentPendingFees.find((fee) => String(fee.id) === selectedPendingFeeId) || null;
  const selectedPendingFees = selectedStudentPendingFees.filter((fee) => selectedPendingFeeIds.includes(String(fee.id)));
  const selectedPaymentStages = new Set(selectedPendingFees.map((fee) => getFeePaymentStage(fee, selectedStudent)));
  const selectedPendingAmount = selectedPendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const oldDuePendingFees = selectedStudentPendingFees.filter((fee) => getFeePaymentStage(fee, selectedStudent) === 'old');
  const admissionPendingFees = selectedStudentPendingFees.filter((fee) => getFeePaymentStage(fee, selectedStudent) === 'admission');
  const blockingOldDue = oldDuePendingFees[0] || null;
  const blockingAdmissionFee = admissionPendingFees[0] || null;
  const canCollectOtherFee = Boolean(selectedStudent && !blockingOldDue && !blockingAdmissionFee);
  const isOtherFeeSelected = formData.type === 'Other Fee';
  const allowedPendingFees = blockingOldDue
    ? oldDuePendingFees
    : blockingAdmissionFee
      ? admissionPendingFees
      : selectedStudentPendingFees;
  const feeLedgerOptions: Array<{ id: number | string; name: string }> = selectedStudent
    ? [
        ...Array.from(new Map<string, { id: number | string; name: string }>(allowedPendingFees.map((fee) => [String(fee.type || ''), { id: fee.id, name: String(fee.type || '') }])).values()).filter((ledger) => ledger.name),
        ...(canCollectOtherFee ? [{ id: 'other-fee', name: 'Other Fee' }] : []),
      ]
    : ledgers;
  const matchingStudents = students.filter((student) => {
    if (!studentSearch.trim()) {
      return true;
    }

    const query = studentSearch.toLowerCase();
    return (
      String(student.name || '').toLowerCase().includes(query) ||
      String(student.reg_no || '').toLowerCase().includes(query)
    );
  });
  const selectedStudentTotalFee = !selectedStudent ? 0 : (() => {
    const d = selectedStudent.dynamic_fees;
    if (d) {
      return Number(d.dynamic_admission_fee || 0) + Number(d.dynamic_coaching_fee || 0) + Number(d.dynamic_transport_fee || 0) + Number(d.dynamic_entrance_fee || 0) + Number(d.dynamic_fooding_fee || 0) + Number(d.dynamic_hostel_fee || 0);
    }
    return Number(selectedStudent.admission_fee || 0) +
      Number(selectedStudent.coaching_fee || 0) +
      Number(selectedStudent.transport_fee || 0) +
      Number(selectedStudent.entrance_fee || 0) +
      Number(selectedStudent.fooding_fee || 0) +
      Number(selectedStudent.hostel_fee || 0);
  })();
  const selectedStudentPaidAmount = selectedStudent
    ? fees
        .filter((fee) => fee.student_id === selectedStudent.id && fee.status === 'paid')
        .reduce((sum, fee) => sum + Number(fee.amount || 0), 0)
    : 0;
  const selectedStudentDueAmount = Math.max(selectedStudentTotalFee - selectedStudentPaidAmount, 0);
  const selectedStudentPendingTotal = selectedStudentPendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const profileStudentPendingFees = profileStudent
    ? fees
        .filter((fee) => fee.student_id === profileStudent.id && fee.status === 'pending')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];
  const profileStudentPaidFees = profileStudent
    ? fees
        .filter((fee) => fee.student_id === profileStudent.id && fee.status === 'paid')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];
  const profileStudentPendingTotal = profileStudentPendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
  const profileStudentPaidTotal = profileStudentPaidFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

  const selectStudentWithFees = (studentId: string, feesSource: any[], studentsSource: any[]) => {
    const student = studentsSource.find((item) => String(item.id) === studentId);
    const pendingFeesForStudent = feesSource
      .filter((fee) => fee.student_id === student?.id && fee.status === 'pending')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pendingOldDue = pendingFeesForStudent.find((fee) => getFeePaymentStage(fee, student) === 'old');
    const pendingAdmission = pendingFeesForStudent.find((fee) => getFeePaymentStage(fee, student) === 'admission');
    const firstPendingFee = pendingFeesForStudent[0];
    const initialFee = pendingOldDue || pendingAdmission || firstPendingFee;
    
    setSelectedPendingFeeId(initialFee ? String(initialFee.id) : '');
    setSelectedPendingFeeIds(initialFee ? [String(initialFee.id)] : []);
    setFormData({
      ...formData,
      student_id: studentId,
      discount: '0',
      amount: initialFee ? String(initialFee.amount || 0) : '',
      type: initialFee?.type || '',
      reference_no: '',
      remark: '',
    });
    setStudentSearch(student ? `${student.name} (${student.reg_no})` : '');
  };

  const handleStudentSelect = async (studentId: string) => {
    selectStudentWithFees(studentId, fees, students);

    if (user?.role === 'admin') {
      const syncRes = await fetch(`/api/admin/students/${studentId}/sync-fees`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });

      if (syncRes.ok) {
        const freshData = await fetchData();
        if (freshData) {
          selectStudentWithFees(studentId, freshData.fees, freshData.students);
        }
      }
    }
  };

  const handlePendingFeeChange = (feeId: string) => {
    setSelectedPendingFeeId(feeId);
    setSelectedPendingFeeIds(feeId ? [feeId] : []);
    const fee = selectedStudentPendingFees.find((item) => String(item.id) === feeId);
    if (!fee) return;

    setFormData((prev) => ({
      ...prev,
      type: fee.type,
      discount: '0',
      amount: String(fee.amount || 0),
    }));
  };

  const updateSelectedPendingFees = (feeIds: string[]) => {
    const pendingRows = selectedStudentPendingFees.filter((fee) => feeIds.includes(String(fee.id)));
    const firstFee = pendingRows[0] || null;
    const total = pendingRows.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);

    setSelectedPendingFeeId(firstFee ? String(firstFee.id) : '');
    setSelectedPendingFeeIds(feeIds);
    setFormData((prev) => ({
      ...prev,
      type: pendingRows.length > 1 ? 'Fee Collection' : firstFee?.type || '',
      discount: '0',
      amount: total ? String(total) : '',
    }));
  };

  const togglePendingFee = (fee: any) => {
    const feeId = String(fee.id);
    const stage = getFeePaymentStage(fee, selectedStudent);
    if (stage === 'old' || stage === 'admission' || blockingAdmissionFee) {
      handlePendingFeeChange(feeId);
      return;
    }

    const nextIds = selectedPendingFeeIds.includes(feeId)
      ? selectedPendingFeeIds.filter((id) => id !== feeId)
      : [...selectedPendingFeeIds, feeId];
    updateSelectedPendingFees(nextIds);
  };

  const handleFeeLedgerChange = (feeType: string) => {
    const matchingPendingFee = allowedPendingFees.find((fee) => String(fee.type || '') === feeType);
    if (matchingPendingFee) {
      handlePendingFeeChange(String(matchingPendingFee.id));
      return;
    }

    if (feeType === 'Other Fee') {
      setSelectedPendingFeeId('');
      setSelectedPendingFeeIds([]);
      setFormData((prev) => ({
        ...prev,
        type: 'Other Fee',
        discount: '0',
        amount: '',
        remark: '',
      }));
      return;
    }

    setSelectedPendingFeeId('');
    setSelectedPendingFeeIds([]);
    setFormData((prev) => ({
      ...prev,
      type: feeType,
      discount: '0',
      amount: '',
      remark: '',
    }));
  };

  const openStudentProfile = (studentId: number) => {
    const student = students.find((item) => item.id === studentId) || null;
    setProfileStudent(student);
  };

  const handleDiscountChange = (discountValue: string) => {
    if (!selectedPendingFee || isOtherFeeSelected) {
      setFormData({
        ...formData,
        discount: '0',
        amount: '',
      });
      return;
    }

    const discount = Number(discountValue || 0);
    const baseAmount = selectedPendingFees.length > 1 ? selectedPendingAmount : Number(selectedPendingFee.amount || 0);
    const safeDiscount = Math.min(Math.max(discount, 0), baseAmount);
    const finalAmount = Math.max(baseAmount - safeDiscount, 0);
    setFormData({
      ...formData,
      discount: String(safeDiscount),
      amount: selectedStudent ? String(finalAmount) : formData.amount,
    });
  };

  const handlePrintReceipt = (fee: any) => {
    const student = students.find((item) => item.id === fee.student_id);
    const receiptDate = formatReceiptDateTime(fee.date);
    const particulars = fee.type === 'Fee Collection' ? 'Fee' : fee.type;
    const paidBy = fee.mode || 'Cash';
    const referenceNo = fee.reference_no ? `<div class="footer-note">Reference No.: ${fee.reference_no}</div>` : '';
    const remark = fee.remark ? `<div class="footer-note">Remark: ${fee.remark}</div>` : '';
    const amount = Number(fee.amount || 0);

    const receiptHtml = `
      <div class="receipt">
        <div class="receipt-title">Money Receipt</div>
        <div class="school-name">SVM CLASSES</div>
        <div class="school-meta">Amrit Vihar, Digapahandi (Ganjam)</div>
        <div class="school-meta">Ph:9439326301, www.svmclasses.com</div>

        <div class="row spread">
          <span><strong>Receipt No.:</strong> ${fee.bill_no || fee.id}</span>
          <span><strong>Date :</strong> ${receiptDate}</span>
        </div>

        <div class="row"><strong>Name :</strong> ${student?.name || fee.student_name || ''}</div>
        <div class="row spread">
          <span><strong>Class.:</strong> ${student?.class_name || ''}</span>
          <span><strong>Student Id :</strong> ${student?.reg_no || ''}</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Particulars</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>${particulars}</td>
              <td>${amount}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>Paid By : ${paidBy}</strong></td>
              <td><strong>${amount}/-</strong></td>
            </tr>
          </tbody>
        </table>

        <div class="footer-note">All fees listed above are final and non-refundable once paid</div>
        ${referenceNo}
        ${remark}
      </div>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=700');
    if (!printWindow) {
      setNotice({ title: 'Print Blocked', message: 'Unable to open print window. Please allow pop-ups and try again.', tone: 'error' });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt ${fee.bill_no || fee.id}</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial, sans-serif;
              background: #fff;
              color: #111827;
            }
            .sheet {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 14px;
            }
            .receipt {
              border: 1px solid #9ca3af;
              padding: 8px 10px;
            }
            .receipt-title {
              text-align: center;
              text-decoration: underline;
              font-size: 13px;
              margin-bottom: 4px;
            }
            .school-name {
              text-align: center;
              font-size: 24px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .school-meta {
              text-align: center;
              font-size: 13px;
              margin-bottom: 2px;
            }
            .row {
              font-size: 13px;
              margin-top: 8px;
            }
            .spread {
              display: flex;
              justify-content: space-between;
              gap: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 8px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #9ca3af;
              padding: 5px 6px;
              text-align: left;
            }
            th:last-child, td:last-child {
              text-align: right;
            }
            .footer-note {
              margin-top: 8px;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${receiptHtml}
            ${receiptHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees & Dues"
        description="Collect payments, clear pending dues, and print student receipts."
        actions={
          <>
          <Link
            to="/fees/reports"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-all hover:bg-indigo-50"
          >
            Due Reports
            <ArrowRight className="w-4 h-4" />
          </Link>
          {user?.role === 'admin' && (
            <Button
              variant="success"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus className="w-5 h-5" />
              Collect Payment
            </Button>
          )}
          </>
        }
      />

      <div id="fee-summary" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Collected This Month" value={formatCurrency(totalCollected)} />
        <StatCard label="Pending Dues" value={formatCurrency(pendingAmount)} valueClassName="text-rose-600" />
        <StatCard label="Collected Today" value={formatCurrency(todayCollection)} valueClassName="text-emerald-600" />
      </div>

      <TableContainer id="fee-register" className="scroll-mt-24">
        <TableToolbar>
          <div className="relative w-64">
            <Input
              type="text"
              placeholder="Search by receipt, student, ledger or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              className="bg-white py-2"
            />
          </div>
          <Link
            to="/fees/reports"
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Open Due Reports
          </Link>
        </TableToolbar>
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="hover:bg-transparent">
                <TableHeaderCell>Receipt No</TableHeaderCell>
                <TableHeaderCell>Student</TableHeaderCell>
                <TableHeaderCell>Fee Type</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                {user?.role === 'admin' && (
                  <TableHeaderCell className="text-center">Actions</TableHeaderCell>
                )}
                <TableHeaderCell className="text-right">Receipt</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedFees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell className="font-mono">{fee.bill_no}</TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    <button
                      type="button"
                      onClick={() => openStudentProfile(fee.student_id)}
                      className="rounded-md text-left text-indigo-700 transition-colors hover:text-indigo-900 hover:underline"
                    >
                      {fee.student_name}
                    </button>
                  </TableCell>
                  <TableCell>{fee.type}</TableCell>
                  <TableCell className="font-bold text-slate-900">{formatCurrency(Number(fee.amount))}</TableCell>
                  <TableCell>{format(new Date(fee.date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      fee.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : fee.status === 'cancelled'
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-amber-100 text-amber-700'
                    }`}>
                      {fee.status}
                    </span>
                  </TableCell>
                  {user?.role === 'admin' && (
                    <TableCell>
                      <div className="flex flex-wrap justify-center gap-2">
                        {fee.status !== 'paid' && (
                          <Button
                            onClick={() => openEditModal(fee)}
                            variant="outline"
                            size="sm"
                            className="border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          >
                            Edit
                          </Button>
                        )}
                        {fee.status === 'paid' && (
                          <Button
                            onClick={() => handleCancelPayment(fee)}
                            variant="outline"
                            size="sm"
                            className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                        {fee.status !== 'paid' && (
                          <Button
                            onClick={() => handleDeletePayment(fee)}
                            variant="outline"
                            size="sm"
                            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      onClick={() => handlePrintReceipt(fee)}
                      variant="ghost"
                      size="icon"
                      className="text-indigo-600 hover:bg-white hover:shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredFees.length === 0 && (
                <EmptyTableRow colSpan={user?.role === 'admin' ? 8 : 7}>No fee records match your search.</EmptyTableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalItems={filteredFees.length}
          pageSize={pageSize}
          itemName="fees"
          onPageChange={setCurrentPage}
        />
      </TableContainer>

      {isModalOpen && (
        <Modal
          onClose={() => setIsModalOpen(false)}
          title={
            <>
              Student Details
              {selectedStudent?.reg_no ? (
                <>
                  {' '}for Student :{' '}
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                    {selectedStudent.reg_no}
                  </span>
                </>
              ) : null}
            </>
          }
        >
            <form onSubmit={handleSubmit} className="space-y-6 p-6 overflow-y-auto">
              <div className="space-y-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-500">Select Student</label>
                  <div className="relative">
                    <input
                      required
                      type="text"
                      placeholder="Type student name or registration no."
                      className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      value={studentSearch}
                      onChange={(e) => {
                        setStudentSearch(e.target.value);
                        setSelectedPendingFeeId('');
                        setSelectedPendingFeeIds([]);
                        setFormData({
                          ...formData,
                          student_id: '',
                          discount: '0',
                          amount: '',
                          reference_no: '',
                          remark: '',
                        });
                      }}
                    />
                    {studentSearch.trim() && !formData.student_id && (
                      <div className="absolute z-20 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                        {matchingStudents.length > 0 ? matchingStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleStudentSelect(String(student.id))}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-slate-50"
                          >
                            <span className="font-medium text-slate-900">{student.name}</span>
                            <span className="text-sm text-slate-500">{student.reg_no}</span>
                          </button>
                        )) : (
                          <div className="px-4 py-3 text-sm text-slate-500">No matching students found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {blockingOldDue && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-rose-800">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Old Due Pending</h4>
                      <p className="text-sm mt-0.5">Only old due can be collected now. Admission and other fees will unlock after all old dues are cleared.</p>
                    </div>
                  </div>
                  <Link 
                    to="/old-due-report"
                    onClick={() => setIsModalOpen(false)}
                    className="shrink-0 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors text-center"
                  >
                    Go to Old Due Report
                  </Link>
                </div>
              )}

              {!blockingOldDue && blockingAdmissionFee && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                  <div className="flex items-center gap-3 text-amber-800">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <h4 className="font-bold text-sm">Admission Fee Pending</h4>
                      <p className="text-sm mt-0.5">Student MUST pay their Admission fee before any other fees can be collected.</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fee Ledger</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.type}
                    onChange={(e) => handleFeeLedgerChange(e.target.value)}
                    disabled={!selectedStudent || (allowedPendingFees.length === 0 && !canCollectOtherFee)}
                  >
                    {selectedStudent && feeLedgerOptions.length === 0 ? (
                      <option value="">No payable pending fee</option>
                    ) : (
                      feeLedgerOptions.map(l => (
                        <option key={l.id} value={l.name}>{l.name}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Student Name</label>
                  <input
                    readOnly
                    value={selectedStudent?.name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Father Name</label>
                  <input
                    readOnly
                    value={selectedStudent?.father_name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mobile No.</label>
                  <input
                    readOnly
                    value={selectedStudent?.phone || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Due Amount</label>
                  <input
                    readOnly
                    value={selectedStudent ? String(selectedPendingFees.length ? selectedPendingAmount : selectedStudentPendingTotal) : ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Session</label>
                  <input
                    readOnly
                    value={selectedStudent?.session || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Study Class</label>
                  <input
                    readOnly
                    value={selectedStudent?.class_name || ''}
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-4">
                  <label className="text-sm font-semibold text-slate-700">Pending Fee To Settle</label>
                  {isOtherFeeSelected ? (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
                      Other Fee is a direct receipt. Enter amount and remark below.
                    </div>
                  ) : allowedPendingFees.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">
                      No pending fee rows for this student
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {allowedPendingFees.map((fee) => {
                        const feeId = String(fee.id);
                        const checked = selectedPendingFeeIds.includes(feeId);
                        const stage = getFeePaymentStage(fee, selectedStudent);
                        const singleOnly = stage === 'admission' || stage === 'old' || Boolean(blockingAdmissionFee);
                        return (
                          <label
                            key={fee.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                              checked ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <input
                              type={singleOnly ? 'radio' : 'checkbox'}
                              name="pending_fee_to_settle"
                              checked={checked}
                              disabled={!selectedStudent}
                              onChange={() => togglePendingFee(fee)}
                              className="h-4 w-4 accent-indigo-600"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block font-bold">{fee.type}</span>
                              <span className="block text-xs text-slate-500">{fee.bill_no} - {formatCurrency(Number(fee.amount || 0))}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {allowedPendingFees.length > 1 && !blockingAdmissionFee && !blockingOldDue && (
                    <p className="text-xs font-medium text-slate-500">You can select multiple regular fee ledgers in one receipt after admission fee is cleared.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Discount</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.discount}
                    onChange={(e) => handleDiscountChange(e.target.value)}
                    disabled={selectedPendingFees.length > 1 || isOtherFeeSelected}
                  />
                  {isOtherFeeSelected && (
                    <p className="text-xs text-slate-500">Discount is not used for direct other fee receipts.</p>
                  )}
                  {selectedPendingFees.length > 1 && (
                    <p className="text-xs text-slate-500">Discount is available only when settling one fee ledger.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Fee</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="number"
                      min="0"
                      readOnly={!isOtherFeeSelected}
                      className={`w-full rounded-xl border-none py-2.5 pl-11 pr-4 text-slate-700 outline-none disabled:opacity-50 ${isOtherFeeSelected ? 'bg-slate-50 focus:ring-2 focus:ring-indigo-500' : 'cursor-not-allowed bg-slate-100'}`}
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mode</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.mode}
                    onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Reference No.</label>
                  <input
                    className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                    value={formData.reference_no}
                    onChange={(e) => setFormData({ ...formData, reference_no: e.target.value })}
                  />
                </div>
                {isOtherFeeSelected && (
                  <div className="space-y-2 xl:col-span-4">
                    <label className="text-sm font-semibold text-slate-700">Remark <span className="text-rose-500">*</span></label>
                    <textarea
                      required
                      className="min-h-24 w-full rounded-xl border-none bg-slate-50 px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.remark}
                      onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                      placeholder="Example: ID card fine, extra form fee, special material charge"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,320px)_1fr] md:items-end">
                <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Payment Date</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
                </div>
                <Button 
                  type="submit"
                  disabled={
                    !selectedStudent ||
                    (!isOtherFeeSelected && selectedPendingFees.length === 0) ||
                    (selectedPaymentStages.size > 1) ||
                    (Boolean(blockingOldDue) && !selectedPaymentStages.has('old')) ||
                    (isOtherFeeSelected && (!formData.amount || !formData.remark.trim())) ||
                    (!blockingOldDue && Boolean(blockingAdmissionFee) && selectedPendingFee?.id !== blockingAdmissionFee?.id)
                  }
                  className="w-full px-6 py-3 font-bold"
                >
                  Save and Print
                </Button>
              </div>
            </form>
        </Modal>
      )}

      {isEditModalOpen && editingFee && (
        <Modal title="Edit Fee Amount" onClose={() => setIsEditModalOpen(false)} className="max-w-md">
            <form onSubmit={handleEditSubmit} className="space-y-6 p-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-900">{editingFee.student_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-semibold text-slate-900">{editingFee.bill_no}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fee Type:</span>
                  <span className="font-semibold text-slate-900">{editingFee.type}</span>
                </div>
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="text-sm font-semibold text-slate-700">Update Amount <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <IndianRupee className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData((current) => ({ ...current, amount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Admin Password <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="password"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={editFormData.admin_password}
                    onChange={(e) => setEditFormData((current) => ({ ...current, admin_password: e.target.value }))}
                    placeholder="Confirm admin password"
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button 
                  type="submit"
                  variant="success"
                  className="w-full px-4 py-3 font-bold"
                >
                  Save Changes
                </Button>
              </div>
            </form>
        </Modal>
      )}

      {sensitiveAction && (
        <Modal
          title={sensitiveAction.type === 'cancel' ? 'Cancel Payment' : 'Delete Fee Row'}
          onClose={() => setSensitiveAction(null)}
          className="max-w-md"
        >
          <form onSubmit={handleSensitiveActionSubmit} className="space-y-5 p-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">{sensitiveAction.fee.student_name}</p>
              <p className="mt-1">{sensitiveAction.fee.type} - {sensitiveAction.fee.bill_no || sensitiveAction.fee.id}</p>
              <p className="mt-2">
                {sensitiveAction.type === 'cancel'
                  ? 'This will cancel the paid receipt and restore the due amount.'
                  : 'This will permanently delete this pending/cancelled fee row.'}
              </p>
            </div>
            {sensitiveAction.type === 'cancel' && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Reason</label>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={sensitiveAction.reason}
                  onChange={(e) => setSensitiveAction((current) => current ? { ...current, reason: e.target.value } : current)}
                  placeholder="Why is this payment being cancelled?"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Admin Password</label>
              <input
                required
                type="password"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={sensitiveAction.admin_password}
                onChange={(e) => setSensitiveAction((current) => current ? { ...current, admin_password: e.target.value } : current)}
                placeholder="Confirm admin password"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSensitiveAction(null)}>Close</Button>
              <Button type="submit" variant={sensitiveAction.type === 'cancel' ? 'danger' : 'danger'}>
                {sensitiveAction.type === 'cancel' ? 'Cancel Payment' : 'Delete Row'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {notice && (
        <MessageDialog
          title={notice.title}
          message={notice.message}
          tone={notice.tone}
          onClose={() => setNotice(null)}
        />
      )}

      {profileStudent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{profileStudent.name}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {profileStudent.reg_no} • {profileStudent.class_name} • {profileStudent.session}
                </p>
              </div>
              <button
                onClick={() => setProfileStudent(null)}
                className="rounded-full p-2 transition-colors hover:bg-slate-100"
              >
                <Plus className="h-6 w-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-92px)] overflow-y-auto p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Basic Details</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Date of Join</span><span className="text-right font-semibold text-slate-900">{profileStudent.admission_date || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Date of Birth</span><span className="text-right font-semibold text-slate-900">{profileStudent.dob || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Gender</span><span className="text-right font-semibold text-slate-900">{profileStudent.gender || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Stream</span><span className="text-right font-semibold text-slate-900">{profileStudent.stream || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Status</span><span className="text-right font-semibold capitalize text-slate-900">{profileStudent.status || 'NA'}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Contact Details</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Father</span><span className="text-right font-semibold text-slate-900">{profileStudent.father_name || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Mother</span><span className="text-right font-semibold text-slate-900">{profileStudent.mother_name || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Student Phone</span><span className="text-right font-semibold text-slate-900">{profileStudent.phone || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Father Phone</span><span className="text-right font-semibold text-slate-900">{profileStudent.father_phone || 'NA'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Address</span><span className="text-right font-semibold text-slate-900">{profileStudent.address || 'NA'}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Fee Summary</p>
                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Pending Rows</span><span className="text-right font-semibold text-rose-600">{profileStudentPendingFees.length}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Pending Amount</span><span className="text-right font-semibold text-rose-600">{formatCurrency(profileStudentPendingTotal)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Paid Rows</span><span className="text-right font-semibold text-emerald-600">{profileStudentPaidFees.length}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Paid Amount</span><span className="text-right font-semibold text-emerald-600">{formatCurrency(profileStudentPaidTotal)}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-slate-500">Hostel</span><span className="text-right font-semibold text-slate-900">{profileStudent.hostel_required || 'NA'}</span></div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Pending Dues</h4>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {profileStudentPendingFees.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-slate-500">No pending dues for this student.</div>
                    ) : (
                      <Table className="text-sm">
                        <TableHead className="bg-white">
                          <TableRow className="hover:bg-transparent">
                            <TableHeaderCell className="px-5 py-3">Ledger</TableHeaderCell>
                            <TableHeaderCell className="px-5 py-3">Receipt No</TableHeaderCell>
                            <TableHeaderCell className="px-5 py-3 text-right">Amount</TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {profileStudentPendingFees.map((fee) => (
                            <TableRow key={fee.id}>
                              <TableCell className="px-5 py-3">{fee.type}</TableCell>
                              <TableCell className="px-5 py-3 font-mono text-xs">{fee.bill_no}</TableCell>
                              <TableCell className="px-5 py-3 text-right font-semibold text-rose-600">{formatCurrency(Number(fee.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Recent Payments</h4>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {profileStudentPaidFees.length === 0 ? (
                      <div className="px-5 py-8 text-sm text-slate-500">No payments recorded yet.</div>
                    ) : (
                      <Table className="text-sm">
                        <TableHead className="bg-white">
                          <TableRow className="hover:bg-transparent">
                            <TableHeaderCell className="px-5 py-3">Ledger</TableHeaderCell>
                            <TableHeaderCell className="px-5 py-3">Date</TableHeaderCell>
                            <TableHeaderCell className="px-5 py-3 text-right">Amount</TableHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {profileStudentPaidFees.slice(0, 10).map((fee) => (
                            <TableRow key={fee.id}>
                              <TableCell className="px-5 py-3">{fee.type}</TableCell>
                              <TableCell className="px-5 py-3">{format(new Date(fee.date), 'MMM dd, yyyy')}</TableCell>
                              <TableCell className="px-5 py-3 text-right font-semibold text-emerald-600">{formatCurrency(Number(fee.amount || 0))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
