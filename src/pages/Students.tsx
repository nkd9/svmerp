import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Eye, 
  Camera, 
  Filter, 
  Download, 
  UserPlus,
  ArrowLeft,
  Save,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Student {
  id: number;
  name: string;
  father_name: string;
  mother_name: string;
  phone: string;
  father_phone: string;
  mother_phone: string;
  address: string;
  post: string;
  pin_code: string;
  thana: string;
  country: string;
  state: string;
  district: string;
  landmark: string;
  email: string;
  dob: string;
  age: string;
  gender: string;
  class_id: number;
  class_name?: string;
  section: string;
  session: string;
  category: string;
  student_group: string;
  occupation: string;
  admission_date: string;
  reg_no: string;
  photo_url: string;
  roll_no: string;
  rfid_card_no: string;
  hostel_required: string;
  student_aadhaar_no: string;
  mother_aadhaar_no: string;
  father_aadhaar_no: string;
  bank_name: string;
  account_no: string;
  ifsc: string;
  guardian1_relation: string;
  guardian1_mobile: string;
  guardian1_name: string;
  guardian1_address: string;
  guardian1_aadhaar_no: string;
  guardian2_relation: string;
  guardian2_mobile: string;
  guardian2_name: string;
  guardian2_address: string;
  guardian2_aadhaar_no: string;
  coaching_fee: number;
  admission_fee: number;
  transport: string;
  transport_fee: number;
  entrance: string;
  entrance_fee: number;
  fooding: string;
  fooding_fee: number;
  status: string;
}

interface Class {
  id: number;
  name: string;
}

interface CloudinarySignatureResponse {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
}

type CustomFieldKey =
  | 'id'
  | 'name'
  | 'gender'
  | 'dob'
  | 'father_name'
  | 'mother_name'
  | 'phone'
  | 'address'
  | 'reg_no'
  | 'student_aadhaar_no'
  | 'father_aadhaar_no'
  | 'mother_aadhaar_no'
  | 'bank_name'
  | 'account_no'
  | 'ifsc';

const MAX_PHOTO_DIMENSION = 1280;
const PHOTO_OUTPUT_QUALITY = 0.82;
const MAX_OPTIMIZED_PHOTO_BYTES = 1024 * 1024;

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load image for optimization'));
      img.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function optimizeStudentPhoto(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image optimization is not supported in this browser');
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('Failed to optimize the image'));
        return;
      }

      resolve(result);
    }, 'image/jpeg', PHOTO_OUTPUT_QUALITY);
  });

  if (blob.size > MAX_OPTIMIZED_PHOTO_BYTES) {
    throw new Error('Optimized image is still too large. Please choose a smaller photo.');
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'student-photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export default function Students() {
  const occupationOptions = [
    'Govt Employee',
    'Private Employee',
    'Business',
    'Farmer',
    'Self Employed',
    'Homemaker',
    'Teacher',
    'Doctor',
    'Engineer',
    'Other'
  ];

  const emptyStudentForm = (): Partial<Student> => ({
    name: '',
    father_name: '',
    mother_name: '',
    phone: '',
    father_phone: '',
    mother_phone: '',
    address: '',
    post: '',
    pin_code: '',
    thana: '',
    country: 'India',
    state: '',
    district: '',
    landmark: '',
    email: '',
    dob: '',
    age: '',
    gender: 'Male',
    class_id: 0,
    section: 'A',
    session: '2025-2026',
    category: 'General',
    student_group: 'None',
    occupation: '',
    admission_date: new Date().toISOString().split('T')[0],
    reg_no: `REG-${Date.now().toString().slice(-6)}`,
    photo_url: '',
    roll_no: '',
    rfid_card_no: '',
    hostel_required: 'No',
    student_aadhaar_no: '',
    mother_aadhaar_no: '',
    father_aadhaar_no: '',
    bank_name: '',
    account_no: '',
    ifsc: '',
    guardian1_relation: '',
    guardian1_mobile: '',
    guardian1_name: '',
    guardian1_address: '',
    guardian1_aadhaar_no: '',
    guardian2_relation: '',
    guardian2_mobile: '',
    guardian2_name: '',
    guardian2_address: '',
    guardian2_aadhaar_no: '',
    coaching_fee: 30000,
    admission_fee: 10000,
    transport: 'No',
    transport_fee: 0,
    entrance: 'No',
    entrance_fee: 0,
    fooding: 'No',
    fooding_fee: 0,
    status: 'active'
  });

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form' | 'profile' | 'reports'>('list');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<Partial<Student>>(emptyStudentForm());
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');

  // Report Filters
  const [reportFilters, setReportFilters] = useState({
    class_id: '',
    category: '',
    student_group: '',
    session: '2025-2026',
    status: 'No',
    report_detail: 'Admission',
    custom_class_id: '',
    custom_session: '2025-2026',
    gender: 'Male'
  });
  const [reportData, setReportData] = useState<Student[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedReportFields, setSelectedReportFields] = useState<CustomFieldKey[]>(['id', 'name', 'gender', 'reg_no', 'phone']);
  const displayValue = (value?: string | number | null) => {
    if (value === undefined || value === null || value === '') {
      return '--';
    }

    return value;
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
      .map(
        (row) =>
          `<tr>${headers.map((header) => `<td>${escapeCell(row[header] ?? '')}</td>`).join('')}</tr>`,
      )
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [studentsRes, classesRes] = await Promise.all([
        fetch('/api/students', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/classes', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (studentsRes.ok && classesRes.ok) {
        setStudents(await studentsRes.json());
        setClasses(await classesRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setPhotoUploadError('Please choose a valid image file.');
      return;
    }

    setPhotoUploadError('');
    setIsUploadingPhoto(true);

    try {
      const optimizedFile = await optimizeStudentPhoto(file);
      const previewUrl = URL.createObjectURL(optimizedFile);
      setPhotoPreviewUrl((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return previewUrl;
      });

      const token = localStorage.getItem('token');
      const signatureRes = await fetch('/api/uploads/student-photo-signature', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!signatureRes.ok) {
        const data = await signatureRes.json().catch(() => ({ error: 'Could not start photo upload' }));
        throw new Error(data.error || 'Could not start photo upload');
      }

      const signatureData = await signatureRes.json() as CloudinarySignatureResponse;
      const uploadData = new FormData();
      uploadData.append('file', optimizedFile);
      uploadData.append('api_key', signatureData.apiKey);
      uploadData.append('timestamp', String(signatureData.timestamp));
      uploadData.append('signature', signatureData.signature);
      uploadData.append('folder', signatureData.folder);

      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`, {
        method: 'POST',
        body: uploadData
      });

      const cloudinaryJson = await cloudinaryRes.json().catch(() => ({}));
      if (!cloudinaryRes.ok || !cloudinaryJson.secure_url) {
        throw new Error(cloudinaryJson.error?.message || 'Photo upload failed');
      }

      setFormData((currentForm) => ({
        ...currentForm,
        photo_url: cloudinaryJson.secure_url as string,
      }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload photo';
      setPhotoUploadError(message);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isUploadingPhoto) {
        alert('Please wait for the photo upload to finish before saving.');
        return;
      }

      const token = localStorage.getItem('token');
      const url = selectedStudent ? `/api/students/${selectedStudent.id}` : '/api/students';
      const method = selectedStudent ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        alert(selectedStudent ? 'Profile updated successfully' : 'Student registered successfully');
        fetchData();
        setView('list');
        setSelectedStudent(null);
        setPhotoUploadError('');
        setPhotoPreviewUrl((currentPreview) => {
          if (currentPreview) {
            URL.revokeObjectURL(currentPreview);
          }

          return null;
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save student');
      }
    } catch (error) {
      console.error('Error saving student:', error);
    }
  };

  const generateReport = async () => {
    const result = students.filter((student) => {
      if (reportFilters.class_id && String(student.class_id) !== reportFilters.class_id) {
        return false;
      }
      if (reportFilters.session && student.session !== reportFilters.session) {
        return false;
      }

      const detail = reportFilters.report_detail;
      const status = reportFilters.status;

      if (status === 'All') {
        return true;
      }
      if (detail === 'Admission') {
        return status === 'Yes' ? student.admission_fee > 0 : student.admission_fee <= 0;
      }
      if (detail === 'Coaching') {
        return status === 'Yes' ? student.coaching_fee > 0 : student.coaching_fee <= 0;
      }
      if (detail === 'Transport') {
        return student.transport === status;
      }
      if (detail === 'Fooding') {
        return student.fooding === status;
      }
      if (detail === 'Entrance') {
        return student.entrance === status;
      }
      if (detail === 'Hostel') {
        return student.hostel_required === status;
      }
      return true;
    });

    setReportData(result);
    setIsReportModalOpen(true);
  };

  const generateCustomReport = () => {
    const result = students.filter((student) => {
      if (reportFilters.custom_class_id && String(student.class_id) !== reportFilters.custom_class_id) {
        return false;
      }
      if (reportFilters.custom_session && student.session !== reportFilters.custom_session) {
        return false;
      }
      if (reportFilters.gender && student.gender !== reportFilters.gender) {
        return false;
      }
      return true;
    });

    setReportData(result);
    setIsReportModalOpen(true);
  };

  const availableSessions = Array.from(new Set(students.map((student) => student.session).filter(Boolean)));
  const reportFieldOptions: Array<{ key: CustomFieldKey; label: string }> = [
    { key: 'id', label: 'Student Id' },
    { key: 'name', label: 'Student Name' },
    { key: 'gender', label: 'Gender' },
    { key: 'dob', label: 'Birth Date' },
    { key: 'father_name', label: 'Father Name' },
    { key: 'mother_name', label: 'Mother Name' },
    { key: 'phone', label: 'Phone No' },
    { key: 'address', label: 'Address' },
    { key: 'reg_no', label: 'Registration No.' },
    { key: 'student_aadhaar_no', label: 'Student Aadhaar No' },
    { key: 'father_aadhaar_no', label: 'Father Aadhaar No' },
    { key: 'mother_aadhaar_no', label: 'Mother Aadhaar No' },
    { key: 'bank_name', label: 'Bank Name' },
    { key: 'account_no', label: 'Account No' },
    { key: 'ifsc', label: 'IFSC' },
  ];
  const reportFieldHeaders: Record<CustomFieldKey, string> = {
    id: 'Student Id',
    name: 'Student Name',
    gender: 'Gender',
    dob: 'Birth Date',
    father_name: 'Father Name',
    mother_name: 'Mother Name',
    phone: 'Phone No',
    address: 'Address',
    reg_no: 'Registration No.',
    student_aadhaar_no: 'Student Aadhaar No',
    father_aadhaar_no: 'Father Aadhaar No',
    mother_aadhaar_no: 'Mother Aadhaar No',
    bank_name: 'Bank Name',
    account_no: 'Account No',
    ifsc: 'IFSC',
  };
  const categoryKeys = ['SEBC', 'GEN', 'OBC', 'SC', 'ST'] as const;
  const categoryMap: Record<string, typeof categoryKeys[number]> = {
    General: 'GEN',
    OBC: 'OBC',
    SC: 'SC',
    ST: 'ST',
    EWS: 'SEBC',
  };
  const buildGenderSummary = (gender: 'Male' | 'Female') =>
    classes
      .map((classItem) => {
        const classStudents = students.filter(
          (student) =>
            student.class_id === classItem.id &&
            student.gender === gender &&
            (!reportFilters.custom_session || student.session === reportFilters.custom_session),
        );

        const counts = { SEBC: 0, GEN: 0, OBC: 0, SC: 0, ST: 0 };
        classStudents.forEach((student) => {
          const key = categoryMap[student.category] || 'GEN';
          counts[key] += 1;
        });

        return { className: classItem.name, ...counts, total: classStudents.length };
      })
      .filter((item) => item.total > 0);

  const boysSummary = buildGenderSummary('Male');
  const girlsSummary = buildGenderSummary('Female');
  const toggleReportField = (field: CustomFieldKey) => {
    setSelectedReportFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  };
  const exportReportResults = () => {
    const rows = reportData.map((student) => {
      const baseRow = selectedReportFields.reduce<Record<string, string | number>>((acc, field) => {
        acc[reportFieldHeaders[field]] = String(displayValue(student[field]));
        return acc;
      }, {});

      return {
        ...baseRow,
        Class: String(displayValue(student.class_name)),
        Session: String(displayValue(student.session)),
      };
    });

    downloadExcelFile(rows, 'student-report-results');
  };
  const exportSummaryReport = (rows: Array<{ className: string; SEBC: number; GEN: number; OBC: number; SC: number; ST: number; total: number }>, fileName: string) => {
    downloadExcelFile(
      rows.map((row, index) => ({
        Sl: index + 1,
        Class: row.className,
        SEBC: row.SEBC,
        GEN: row.GEN,
        OBC: row.OBC,
        SC: row.SC,
        ST: row.ST,
        Total: row.total,
      })),
      fileName,
    );
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.reg_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone.includes(searchTerm)
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Admission</h1>
          <p className="text-slate-500">Manage student registrations and profiles</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setView('reports')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Download size={18} />
            Reports
          </button>
          <button 
            onClick={() => {
              setSelectedStudent(null);
              setFormData({ ...emptyStudentForm(), class_id: classes[0]?.id || 0 });
              setPhotoUploadError('');
              setPhotoPreviewUrl((currentPreview) => {
                if (currentPreview) {
                  URL.revokeObjectURL(currentPreview);
                }

                return null;
              });
              setView('form');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <UserPlus size={18} />
            New Admission
          </button>
        </div>
      </div>

      {view === 'list' && (
        <div className="space-y-4">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text"
                placeholder="Search by name, registration number or phone..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reg No</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center overflow-hidden border border-indigo-100">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-indigo-600 font-bold">{student.name[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{student.name}</div>
                          <div className="text-xs text-slate-500">{student.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{student.reg_no}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        {student.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{student.category}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${
                        student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button 
                          onClick={() => {
                            setSelectedStudent(student);
                            setView('profile');
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedStudent(student);
                            setPhotoUploadError('');
                            setPhotoPreviewUrl((currentPreview) => {
                              if (currentPreview) {
                                URL.revokeObjectURL(currentPreview);
                              }

                              return null;
                            });
                            setFormData(student);
                            setView('form');
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'form' && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <button onClick={() => {
                setPhotoUploadError('');
                setPhotoPreviewUrl((currentPreview) => {
                  if (currentPreview) {
                    URL.revokeObjectURL(currentPreview);
                  }

                  return null;
                });
                setView('list');
              }} className="p-2 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-500">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedStudent ? 'Edit Student Profile' : 'New Student Admission'}
                </h2>
                <p className="text-sm text-slate-500">Enter student details to register</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-colors group-hover:border-indigo-300">
                  {photoPreviewUrl || formData.photo_url ? (
                    <img src={photoPreviewUrl || formData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="text-slate-300" size={32} />
                  )}
                </div>
                <label className={`absolute -bottom-2 -right-2 p-2.5 text-white rounded-xl shadow-lg transition-transform group-hover:scale-110 ${isUploadingPhoto ? 'cursor-wait bg-amber-500' : 'cursor-pointer bg-indigo-600 hover:bg-indigo-700'}`}>
                  <Camera size={18} />
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploadingPhoto} />
                </label>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-400">Upload student photo. We resize and optimize it before upload.</p>
              {isUploadingPhoto && <p className="mt-2 text-xs font-semibold text-amber-600">Optimizing and uploading photo...</p>}
              {photoUploadError && <p className="mt-2 text-xs font-semibold text-rose-600">{photoUploadError}</p>}
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Basic Information</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Registration No.</label>
                    <input required type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.reg_no} onChange={(e) => setFormData({ ...formData, reg_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Student Name</label>
                    <input required type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Gender</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date of Join</label>
                    <input required type="date" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.admission_date} onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Date of Birth</label>
                    <input required type="date" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.dob} onChange={(e) => setFormData({ ...formData, dob: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Age</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.age} onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">E Mail</label>
                    <input type="email" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Parent & Contact Details</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Father Name</label>
                    <input required type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.father_name} onChange={(e) => setFormData({ ...formData, father_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Mother Name</label>
                    <input required type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.mother_name} onChange={(e) => setFormData({ ...formData, mother_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Father Phone No.</label>
                    <input type="tel" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.father_phone} onChange={(e) => setFormData({ ...formData, father_phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Mother Phone No.</label>
                    <input type="tel" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.mother_phone} onChange={(e) => setFormData({ ...formData, mother_phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Occupation</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.occupation} onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}>
                      <option value="">Select Occupation</option>
                      {occupationOptions.map((occupation) => (
                        <option key={occupation} value={occupation}>
                          {occupation}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Student Phone No.</label>
                    <input required type="tel" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Address Details</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Address</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Land Mark</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.landmark} onChange={(e) => setFormData({ ...formData, landmark: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Post</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.post} onChange={(e) => setFormData({ ...formData, post: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Pin Code</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.pin_code} onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Thana</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.thana} onChange={(e) => setFormData({ ...formData, thana: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Country</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">State</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">District</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.district} onChange={(e) => setFormData({ ...formData, district: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Academic Details</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Session</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.session} onChange={(e) => setFormData({ ...formData, session: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Select Class</label>
                    <select required className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.class_id} onChange={(e) => setFormData({ ...formData, class_id: parseInt(e.target.value) })}>
                      <option value="">Select Class</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Section</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.section} onChange={(e) => setFormData({ ...formData, section: e.target.value })}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">RFID Card No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.rfid_card_no} onChange={(e) => setFormData({ ...formData, rfid_card_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Reservation Category</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                      <option value="General">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Roll No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.roll_no} onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Group</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.student_group} onChange={(e) => setFormData({ ...formData, student_group: e.target.value })}>
                      <option value="None">None</option>
                      <option value="Science">Science</option>
                      <option value="Commerce">Commerce</option>
                      <option value="Arts">Arts</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Hostel</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.hostel_required} onChange={(e) => setFormData({ ...formData, hostel_required: e.target.value })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Identity & Bank Details</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Student Aadhaar No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.student_aadhaar_no} onChange={(e) => setFormData({ ...formData, student_aadhaar_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Mother Aadhaar No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.mother_aadhaar_no} onChange={(e) => setFormData({ ...formData, mother_aadhaar_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Father Aadhaar No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.father_aadhaar_no} onChange={(e) => setFormData({ ...formData, father_aadhaar_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Bank Name</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Account No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.account_no} onChange={(e) => setFormData({ ...formData, account_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">IFSC</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.ifsc} onChange={(e) => setFormData({ ...formData, ifsc: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Guardian Details</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 1 Relation</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian1_relation} onChange={(e) => setFormData({ ...formData, guardian1_relation: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 1 Mobile</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian1_mobile} onChange={(e) => setFormData({ ...formData, guardian1_mobile: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 1 Name</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian1_name} onChange={(e) => setFormData({ ...formData, guardian1_name: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <label className="text-sm font-semibold text-slate-700">Local Guardian 1 Address</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian1_address} onChange={(e) => setFormData({ ...formData, guardian1_address: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Local Guardian 1 Aadhaar No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian1_aadhaar_no} onChange={(e) => setFormData({ ...formData, guardian1_aadhaar_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 2 Relation</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian2_relation} onChange={(e) => setFormData({ ...formData, guardian2_relation: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 2 Mobile</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian2_mobile} onChange={(e) => setFormData({ ...formData, guardian2_mobile: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Guardian 2 Name</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian2_name} onChange={(e) => setFormData({ ...formData, guardian2_name: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-4">
                    <label className="text-sm font-semibold text-slate-700">Local Guardian 2 Address</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian2_address} onChange={(e) => setFormData({ ...formData, guardian2_address: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">Local Guardian 2 Aadhaar No</label>
                    <input type="text" className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.guardian2_aadhaar_no} onChange={(e) => setFormData({ ...formData, guardian2_aadhaar_no: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Fee Setup</h3>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Coaching Fee</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-amber-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.coaching_fee} onChange={(e) => setFormData({ ...formData, coaching_fee: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Admission Fee</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-amber-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.admission_fee} onChange={(e) => setFormData({ ...formData, admission_fee: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Transport</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.transport} onChange={(e) => setFormData({ ...formData, transport: e.target.value })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Transport Fee</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-amber-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.transport_fee} onChange={(e) => setFormData({ ...formData, transport_fee: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Entrance</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.entrance} onChange={(e) => setFormData({ ...formData, entrance: e.target.value })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Entrance Fee</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-amber-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.entrance_fee} onChange={(e) => setFormData({ ...formData, entrance_fee: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Fooding</label>
                    <select className="w-full px-4 py-2.5 bg-white border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.fooding} onChange={(e) => setFormData({ ...formData, fooding: e.target.value })}>
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Fooding Fee</label>
                    <input type="number" className="w-full px-4 py-2.5 bg-amber-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={formData.fooding_fee} onChange={(e) => setFormData({ ...formData, fooding_fee: Number(e.target.value) })} />
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t border-slate-100">
              <button 
                type="button"
                onClick={() => {
                  setPhotoUploadError('');
                  setPhotoPreviewUrl((currentPreview) => {
                    if (currentPreview) {
                      URL.revokeObjectURL(currentPreview);
                    }

                    return null;
                  });
                  setView('list');
                }}
                className="px-6 py-2.5 text-slate-600 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isUploadingPhoto}
                className={`flex items-center gap-2 px-8 py-2.5 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 ${isUploadingPhoto ? 'cursor-not-allowed bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                <Save size={18} />
                {isUploadingPhoto ? 'Uploading Photo...' : selectedStudent ? 'Update Profile' : 'Register Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'profile' && selectedStudent && (
        <div className="max-w-7xl mx-auto bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="h-40 bg-indigo-600 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>
          </div>
          <div className="px-10 pb-10">
            <div className="relative -mt-16 flex items-end justify-between mb-10">
              <div className="flex items-end gap-8">
                <div className="w-36 h-36 rounded-3xl border-8 border-white bg-slate-100 overflow-hidden shadow-2xl">
                  {selectedStudent.photo_url ? (
                    <img src={selectedStudent.photo_url} alt={selectedStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-indigo-200 font-bold text-5xl">
                      {selectedStudent.name[0]}
                    </div>
                  )}
                </div>
                <div className="pb-4">
                  <h2 className="text-3xl font-bold text-slate-900">{selectedStudent.name}</h2>
                  <p className="text-slate-500 font-medium">{selectedStudent.reg_no} • {selectedStudent.class_name}</p>
                </div>
              </div>
              <div className="flex gap-3 pb-4">
                <button 
                  onClick={() => setView('list')}
                  className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Back to List
                </button>
                <button 
                  onClick={() => {
                    setPhotoUploadError('');
                    setPhotoPreviewUrl((currentPreview) => {
                      if (currentPreview) {
                        URL.revokeObjectURL(currentPreview);
                      }

                      return null;
                    });
                    setFormData(selectedStudent);
                    setView('form');
                  }}
                  className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Edit Profile
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_360px]">
              <div className="space-y-8">
                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Basic Information</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Registration No</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.reg_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Gender</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.gender)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Age</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.age)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Date of Birth</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.dob)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Date of Join</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.admission_date)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Email</div><div className="break-all font-semibold text-slate-900">{displayValue(selectedStudent.email)}</div></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Parent & Contact Details</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Father Name</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.father_name)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Mother Name</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.mother_name)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Occupation</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.occupation)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Father Phone</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.father_phone)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Mother Phone</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.mother_phone)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Student Phone</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.phone)}</div></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Address Details</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="md:col-span-3"><div className="mb-1 text-xs font-bold uppercase text-slate-400">Address</div><div className="font-semibold leading-relaxed text-slate-900">{displayValue(selectedStudent.address)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Landmark</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.landmark)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Post</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.post)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Pin Code</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.pin_code)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Thana</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.thana)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">District</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.district)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">State</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.state)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Country</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.country)}</div></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Academic Details</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Class</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.class_name)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Session</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.session)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Section</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.section)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Category</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.category)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Group</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.student_group)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Roll No</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.roll_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">RFID Card No</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.rfid_card_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Hostel</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.hostel_required)}</div></div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-6">
                  <h3 className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Identity & Bank Details</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Student Aadhaar</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.student_aadhaar_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Mother Aadhaar</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.mother_aadhaar_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Father Aadhaar</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.father_aadhaar_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Bank Name</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.bank_name)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">Account No</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.account_no)}</div></div>
                    <div><div className="mb-1 text-xs font-bold uppercase text-slate-400">IFSC</div><div className="font-semibold text-slate-900">{displayValue(selectedStudent.ifsc)}</div></div>
                  </div>
                </section>
              </div>

              <div className="space-y-8">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h4 className="mb-4 text-sm font-bold text-slate-900">Guardian Details</h4>
                  <div className="space-y-5 text-sm text-slate-600">
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">Guardian 1</div>
                      <div className="font-semibold text-slate-900">{displayValue(selectedStudent.guardian1_name)}</div>
                      <div>{displayValue(selectedStudent.guardian1_relation)} • {displayValue(selectedStudent.guardian1_mobile)}</div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-bold uppercase text-slate-400">Guardian 2</div>
                      <div className="font-semibold text-slate-900">{displayValue(selectedStudent.guardian2_name)}</div>
                      <div>{displayValue(selectedStudent.guardian2_relation)} • {displayValue(selectedStudent.guardian2_mobile)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h4 className="mb-4 text-sm font-bold text-slate-900">Fee Setup</h4>
                  <div className="space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between"><span>Coaching Fee</span><span className="font-semibold text-slate-900">Rs {displayValue(selectedStudent.coaching_fee)}</span></div>
                    <div className="flex items-center justify-between"><span>Admission Fee</span><span className="font-semibold text-slate-900">Rs {displayValue(selectedStudent.admission_fee)}</span></div>
                    <div className="flex items-center justify-between"><span>Transport</span><span className="font-semibold text-slate-900">{displayValue(selectedStudent.transport)} {selectedStudent.transport === 'Yes' ? `(Rs ${displayValue(selectedStudent.transport_fee)})` : ''}</span></div>
                    <div className="flex items-center justify-between"><span>Entrance</span><span className="font-semibold text-slate-900">{displayValue(selectedStudent.entrance)} {selectedStudent.entrance === 'Yes' ? `(Rs ${displayValue(selectedStudent.entrance_fee)})` : ''}</span></div>
                    <div className="flex items-center justify-between"><span>Fooding</span><span className="font-semibold text-slate-900">{displayValue(selectedStudent.fooding)} {selectedStudent.fooding === 'Yes' ? `(Rs ${displayValue(selectedStudent.fooding_fee)})` : ''}</span></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <h4 className="mb-4 text-sm font-bold text-slate-900">Quick Actions</h4>
                  <div className="space-y-2">
                    <button className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-indigo-600 transition-all hover:bg-white hover:shadow-sm">
                      View Fee History
                    </button>
                    <button className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-indigo-600 transition-all hover:bg-white hover:shadow-sm">
                      Attendance Report
                    </button>
                    <button className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-indigo-600 transition-all hover:bg-white hover:shadow-sm">
                      Generate ID Card
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button onClick={() => setView('list')} className="p-2 hover:bg-slate-50 rounded-full transition-all text-slate-500">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Student Reports</h2>
                <p className="text-sm text-slate-500">Class, summary and customized student reporting</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4">
              <h3 className="text-2xl font-bold text-white">Select Class Name and Session Report Generate</h3>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 xl:grid-cols-4 xl:items-end">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Class</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                  value={reportFilters.custom_class_id}
                  onChange={(e) => setReportFilters({ ...reportFilters, custom_class_id: e.target.value })}
                >
                  <option value="">-Select-</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Select Session</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                  value={reportFilters.custom_session}
                  onChange={(e) => setReportFilters({ ...reportFilters, custom_session: e.target.value })}
                >
                  {availableSessions.map((session) => <option key={session} value={session}>{session}</option>)}
                </select>
              </div>
              <button
                onClick={generateCustomReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Filter size={18} />
                Generate Report
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4">
              <h3 className="text-2xl font-bold text-white">Search Report</h3>
            </div>
            <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Class</label>
                <select 
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                  value={reportFilters.class_id}
                  onChange={(e) => setReportFilters({ ...reportFilters, class_id: e.target.value })}
                >
                  <option value="">-Select-</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Status</label>
                <select 
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                  value={reportFilters.status}
                  onChange={(e) => setReportFilters({ ...reportFilters, status: e.target.value })}
                >
                  <option value="All">All</option>
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Report Details</label>
                <select 
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                  value={reportFilters.report_detail}
                  onChange={(e) => setReportFilters({ ...reportFilters, report_detail: e.target.value })}
                >
                  <option value="Admission">Admission</option>
                  <option value="Transport">Transport</option>
                  <option value="Fooding">Fooding</option>
                  <option value="Entrance">Entrance</option>
                  <option value="Hostel">Hostel</option>
                  <option value="Coaching">Coaching</option>
                </select>
              </div>
              <button 
                onClick={generateReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl"
              >
                <Filter size={18} />
                Submit
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <div className="flex items-center justify-between bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4">
                <h3 className="text-xl font-bold text-white">Total Boys Class Wise</h3>
                <button
                  onClick={() => exportSummaryReport(boysSummary, 'boys-class-wise-report')}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Download size={16} />
                  Excel
                </button>
              </div>
              <div className="overflow-x-auto p-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Sl.</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Class</th>
                      {categoryKeys.map((key) => <th key={key} className="px-4 py-3 text-sm font-bold text-slate-700">{key}</th>)}
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boysSummary.map((row, index) => (
                      <tr key={row.className} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.className}</td>
                        {categoryKeys.map((key) => <td key={key} className="px-4 py-3 text-sm text-slate-600">{row[key]}</td>)}
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
              <div className="flex items-center justify-between bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4">
                <h3 className="text-xl font-bold text-white">Total Girls Class Wise</h3>
                <button
                  onClick={() => exportSummaryReport(girlsSummary, 'girls-class-wise-report')}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                >
                  <Download size={16} />
                  Excel
                </button>
              </div>
              <div className="overflow-x-auto p-6">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Sl.</th>
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">Class</th>
                      {categoryKeys.map((key) => <th key={key} className="px-4 py-3 text-sm font-bold text-slate-700">{key}</th>)}
                      <th className="px-4 py-3 text-sm font-bold text-slate-700">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {girlsSummary.map((row, index) => (
                      <tr key={row.className} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-sm text-slate-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.className}</td>
                        {categoryKeys.map((key) => <td key={key} className="px-4 py-3 text-sm text-slate-600">{row[key]}</td>)}
                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-6 py-4">
              <h3 className="text-2xl font-bold text-white">Customize Report</h3>
            </div>
            <div className="space-y-8 p-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Select Class</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    value={reportFilters.custom_class_id}
                    onChange={(e) => setReportFilters({ ...reportFilters, custom_class_id: e.target.value })}
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Select Session</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    value={reportFilters.custom_session}
                    onChange={(e) => setReportFilters({ ...reportFilters, custom_session: e.target.value })}
                  >
                    {availableSessions.map((session) => <option key={session} value={session}>{session}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Gender</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition-all focus:ring-2 focus:ring-indigo-500"
                    value={reportFilters.gender}
                    onChange={(e) => setReportFilters({ ...reportFilters, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-3xl font-semibold text-slate-900">Select Required Fields</h3>
                <div className="mb-6 border-t border-slate-200" />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {reportFieldOptions.map((field) => (
                    <label key={field.key} className="flex items-center gap-3 text-lg text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedReportFields.includes(field.key)}
                        onChange={() => toggleReportField(field.key)}
                        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={generateCustomReport}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4f6ef7] to-[#7d5fd6] px-6 py-3 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <Download size={18} />
                  Generate Report
                </button>
                <p className="text-lg font-medium text-slate-500">Note* : For better print align choose 4 to 5 fields .</p>
              </div>
            </div>
          </div>

        </div>
      )}

      <AnimatePresence>
        {isReportModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 backdrop-blur-md p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="max-h-[88vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-2xl"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center justify-between bg-gradient-to-r from-[#4f6ef7] via-[#6777ea] to-[#7d5fd6] px-8 py-5">
                <div>
                  <h3 className="text-xl font-bold text-white">Report Results</h3>
                  <p className="text-sm text-indigo-100">{reportData.length} Students</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={exportReportResults}
                    className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-white/25"
                  >
                    <Download size={16} />
                    Export to Excel
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
                {reportData.length > 0 ? (
                  <table className="w-full text-left">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-100">
                        {selectedReportFields.map((field) => (
                          <th key={field} className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                            {reportFieldHeaders[field]}
                          </th>
                        ))}
                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Class</th>
                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                          {selectedReportFields.map((field) => (
                            <td key={field} className="px-8 py-4 text-sm text-slate-600">
                              {displayValue(s[field])}
                            </td>
                          ))}
                          <td className="px-8 py-4 text-sm text-slate-600">{displayValue(s.class_name)}</td>
                          <td className="px-8 py-4 text-sm text-slate-600">{displayValue(s.session)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-8 py-16 text-center">
                    <h4 className="text-lg font-semibold text-slate-900">No results found</h4>
                    <p className="mt-2 text-sm text-slate-500">Try changing the selected filters and generate the report again.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
