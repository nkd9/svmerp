import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { connectToDatabase } from "../server/database.ts";
import {
  AcademicSessionMaster,
  Attendance,
  AuditLog,
  ClassModel,
  Counter,
  Exam,
  Fee,
  FeeLedger,
  FeeStructure,
  FoodTransaction,
  FoodWallet,
  Hostel,
  HostelAllotment,
  Mark,
  MedicalRecord,
  Room,
  StreamMaster,
  Student,
  Subject,
  Transaction,
  User,
} from "../server/models.ts";

try {
  dotenv.config({ path: ".env.local", override: true });
  dotenv.config();
} catch {
  // fall back to system environment variables
}

type StudentReportRow = {
  serial_no: number;
  category: "NonHostel" | "Hostel";
  legacy_class_name: string;
  legacy_session: string;
  mapped_course_year: string;
  mapped_stream: string;
  mapped_session: string;
  name: string;
  gender: string;
  legacy_student_id: string;
  dob: string;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  address_line_1: string;
  address_line_2: string;
  pin_code: string;
  district: string;
  registration_date: string;
  rfid: string;
  hostel_label: string;
  room_no: string;
  hostel_required: string;
  reg_no: string;
  photo_path: string;
};

type LegacyTransactionRow = {
  serial_no: number;
  legacy_transaction_id: string;
  name: string;
  legacy_class_name: string;
  mapped_course_year: string;
  mapped_stream: string;
  credit_amount: number;
  debit_amount: number;
  mode: string;
  description: string;
  transaction_type: string;
  date: string;
  received_by: string;
  status: string;
  reg_no: string;
};

type LegacyOldDueRow = {
  legacy_student_id: string;
  name: string;
  phone: string;
  due_amount: number;
  legacy_class_name: string;
  mapped_course_year: string;
  mapped_stream: string;
  category: string;
  reg_no: string;
};

type LegacyAdmissionDueRow = {
  serial_no: number;
  reg_no: string;
  name: string;
  father_name: string;
  phone: string;
  due_amount: number;
  legacy_class_name: string;
  mapped_course_year: string;
  mapped_stream: string;
};

type LegacyInstallmentDueRow = {
  serial_no: number;
  reg_no: string;
  name: string;
  parent_phone: string;
  reg_amount: number;
  net_paid_amount: number;
  total_due: number;
  legacy_class_name: string;
  mapped_course_year: string;
  mapped_stream: string;
  legacy_session: string;
  mapped_session: string;
  hostel_status: string;
};

type SnapshotStudents = {
  categories: Array<{
    category: "NonHostel" | "Hostel";
    rows: StudentReportRow[];
  }>;
};

type SnapshotTransactions = {
  total_rows: number;
  rows: LegacyTransactionRow[];
};

type SnapshotOldDue = {
  total_rows: number;
  total_due_amount: number;
  rows: LegacyOldDueRow[];
};

type SnapshotAdmissionDue = {
  total_rows: number;
  total_due_amount: number;
  rows: LegacyAdmissionDueRow[];
};

type SnapshotInstallmentDue = {
  total_rows: number;
  total_due_amount: number;
  rows: LegacyInstallmentDueRow[];
};

type ImportOptions = {
  dryRun: boolean;
  skipBackup: boolean;
  backupDir: string;
};

const TMP_DIR = path.resolve("tmp");
const COLLECTIONS_TO_RESET = [
  ClassModel,
  StreamMaster,
  AcademicSessionMaster,
  Student,
  Fee,
  Transaction,
  FeeLedger,
  FeeStructure,
  Subject,
  Exam,
  Mark,
  Hostel,
  Room,
  HostelAllotment,
  Attendance,
  MedicalRecord,
  FoodWallet,
  FoodTransaction,
  AuditLog,
  Counter,
];

const COUNTER_SEEDS = [
  ["classes", ClassModel],
  ["streams", StreamMaster],
  ["academicSessions", AcademicSessionMaster],
  ["students", Student],
  ["fees", Fee],
  ["transactions", Transaction],
  ["feeLedgers", FeeLedger],
  ["feeStructures", FeeStructure],
  ["subjects", Subject],
  ["exams", Exam],
  ["marks", Mark],
  ["hostels", Hostel],
  ["rooms", Room],
  ["hostelAllotments", HostelAllotment],
  ["attendance", Attendance],
  ["medicalRecords", MedicalRecord],
  ["foodWallets", FoodWallet],
  ["foodTransactions", FoodTransaction],
  ["auditLogs", AuditLog],
] as const;

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeUpper(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/[^\d]/g, "");
}

function normalizeLegacyRegNo(value: unknown) {
  const raw = normalizeUpper(value).replace(/[^A-Z0-9]/g, "");
  if (!raw) return "";
  if (!/^(?:ID)?[A-Z]{1,5}\d{3,}$/.test(raw)) {
    return "";
  }
  if (/^ID[A-Z]{2,}\d+$/.test(raw)) {
    return raw.slice(2);
  }
  return raw;
}

function extractLegacyRegNoFromText(value: unknown) {
  const raw = normalizeUpper(value);
  if (!raw) return "";
  const keywordMatch = raw.match(/(?:REGD\s*NO|REGDNO|FROM\s+ID|ID)\s*[:#-]?\s*([A-Z]{1,5}\d{3,})\b/);
  if (keywordMatch) {
    return normalizeLegacyRegNo(keywordMatch[1]);
  }
  const directWordMatch = raw.match(/\b([A-Z]{1,5}\d{3,})\b/);
  if (directWordMatch) {
    return normalizeLegacyRegNo(directWordMatch[1]);
  }
  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const prefixedMatch = compact.match(/ID([A-Z]{1,5}\d{3,})$/);
  if (prefixedMatch) {
    return normalizeLegacyRegNo(prefixedMatch[1]);
  }
  const directMatch = compact.match(/([A-Z]{1,5}\d{3,})$/);
  if (directMatch) {
    return normalizeLegacyRegNo(directMatch[1]);
  }
  return "";
}

function resolveLegacyRegNo(...values: unknown[]) {
  for (const value of values) {
    const direct = normalizeLegacyRegNo(value);
    if (direct) return direct;
    const extracted = extractLegacyRegNoFromText(value);
    if (extracted) return extracted;
  }
  return "";
}

function normalizeYesNo(value: unknown, fallback = "No") {
  const raw = normalizeText(value).toLowerCase();
  if (raw === "yes" || raw === "y") return "Yes";
  if (raw === "no" || raw === "n") return "No";
  if (raw === "_" || raw === "0" || raw === "") return fallback;
  return fallback;
}

function toIsoDate(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return raw;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const resolved = path.resolve(filePath);
  return JSON.parse(await fs.readFile(resolved, "utf8")) as T;
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function backupExistingCollections(backupDir: string) {
  await ensureDir(backupDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.join(backupDir, `mongo-backup-${timestamp}`);
  await ensureDir(targetDir);

  const collections = [
    ["users", User],
    ["classes", ClassModel],
    ["streams", StreamMaster],
    ["academic_sessions", AcademicSessionMaster],
    ["students", Student],
    ["fees", Fee],
    ["transactions", Transaction],
    ["fee_ledgers", FeeLedger],
    ["fee_structures", FeeStructure],
    ["subjects", Subject],
    ["exams", Exam],
    ["marks", Mark],
    ["hostels", Hostel],
    ["rooms", Room],
    ["hostel_allotments", HostelAllotment],
    ["attendance", Attendance],
    ["medical_records", MedicalRecord],
    ["food_wallets", FoodWallet],
    ["food_transactions", FoodTransaction],
    ["audit_logs", AuditLog],
    ["counters", Counter],
  ] as const;

  for (const [name, model] of collections) {
    const rows = await model.find().lean();
    await fs.writeFile(path.join(targetDir, `${name}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  }

  return targetDir;
}

async function resetCollections() {
  for (const model of COLLECTIONS_TO_RESET) {
    await model.deleteMany({});
  }
}

function buildClassList(
  students: SnapshotStudents,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
  transactions: SnapshotTransactions,
) {
  return Array.from(
    new Set(
      [
        ...students.categories.flatMap((category) => category.rows.map((row) => row.mapped_course_year)),
        ...oldDue.rows.map((row) => row.mapped_course_year),
        ...admissionDue.rows.map((row) => row.mapped_course_year),
        ...installmentDue.rows.map((row) => row.mapped_course_year),
        ...transactions.rows.map((row) => row.mapped_course_year),
      ]
        .map(normalizeText)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function buildStreamList(
  students: SnapshotStudents,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
  transactions: SnapshotTransactions,
) {
  return Array.from(
    new Set(
      [
        ...students.categories.flatMap((category) => category.rows.map((row) => row.mapped_stream)),
        ...oldDue.rows.map((row) => row.mapped_stream),
        ...admissionDue.rows.map((row) => row.mapped_stream),
        ...installmentDue.rows.map((row) => row.mapped_stream),
        ...transactions.rows.map((row) => row.mapped_stream),
      ]
        .map((value) => normalizeText(value) || "None")
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function buildSessionList(students: SnapshotStudents, installmentDue: SnapshotInstallmentDue) {
  return Array.from(
    new Set(
      [
        ...students.categories.flatMap((category) => category.rows.map((row) => row.mapped_session)),
        ...installmentDue.rows.map((row) => row.mapped_session),
      ]
        .map(normalizeText)
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function buildStudentSeedMap(
  students: SnapshotStudents,
  transactions: SnapshotTransactions,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
) {
  const activeStudentRegNos = new Set<string>(
    [
      ...students.categories.flatMap((category) => category.rows.map((row) => resolveLegacyRegNo(row.reg_no, row.legacy_student_id))),
      ...installmentDue.rows.map((row) => resolveLegacyRegNo(row.reg_no)),
    ].filter(Boolean),
  );

  const seeds = new Map<
    string,
    {
      reg_no: string;
      name: string;
      father_name: string;
      mother_name: string;
      phone: string;
      father_phone: string;
      mother_phone: string;
      gender: string;
      dob: string;
      district: string;
      pin_code: string;
      address: string;
      admission_date: string;
      session: string;
      course_year: string;
      stream: string;
      hostel_required: string;
      rfid_card_no: string;
      photo_url: string;
      status: string;
      hasFood: boolean;
      hasTransport: boolean;
      hasHostel: boolean;
      hasEntrance: boolean;
      totals: Record<string, number>;
    }
  >();

  const ensureSeed = (regNo: string) => {
    const normalizedRegNo = normalizeUpper(regNo);
    if (!normalizedRegNo) {
      return null;
    }
    if (!seeds.has(normalizedRegNo)) {
      seeds.set(normalizedRegNo, {
        reg_no: normalizedRegNo,
        name: "",
        father_name: "",
        mother_name: "",
        phone: "",
        father_phone: "",
        mother_phone: "",
        gender: "Male",
        dob: "",
        district: "Ganjam",
        pin_code: "",
        address: "",
        admission_date: "",
        session: "",
        course_year: "",
        stream: "None",
        hostel_required: "No",
        rfid_card_no: "",
        photo_url: "",
        status: activeStudentRegNos.has(normalizedRegNo) ? "active" : "alumni",
        hasFood: false,
        hasTransport: false,
        hasHostel: false,
        hasEntrance: false,
        totals: {},
      });
    }
    return seeds.get(normalizedRegNo)!;
  };

  for (const category of students.categories) {
    for (const row of category.rows) {
      const seed = ensureSeed(resolveLegacyRegNo(row.reg_no, row.legacy_student_id));
      if (!seed) continue;
      seed.name ||= normalizeText(row.name);
      seed.father_name ||= normalizeText(row.father_name);
      seed.mother_name ||= normalizeText(row.mother_name);
      seed.phone ||= normalizePhone(row.father_phone || row.mother_phone);
      seed.father_phone ||= normalizePhone(row.father_phone);
      seed.mother_phone ||= normalizePhone(row.mother_phone);
      seed.gender = normalizeText(row.gender) || seed.gender;
      seed.dob ||= toIsoDate(row.dob);
      seed.district ||= normalizeText(row.district) || "Ganjam";
      seed.pin_code ||= normalizeText(row.pin_code);
      seed.address ||= [normalizeText(row.address_line_1), normalizeText(row.address_line_2)].filter(Boolean).join(", ");
      seed.admission_date ||= toIsoDate(row.registration_date);
      seed.session ||= normalizeText(row.mapped_session);
      seed.course_year ||= normalizeText(row.mapped_course_year);
      seed.stream = normalizeText(row.mapped_stream) || seed.stream;
      seed.hostel_required = normalizeYesNo(row.hostel_required, category.category === "Hostel" ? "Yes" : seed.hostel_required);
      seed.rfid_card_no ||= normalizeText(row.rfid);
      seed.photo_url ||= normalizeText(row.photo_path);
    }
  }

  const markFeeUsage = (seed: NonNullable<ReturnType<typeof ensureSeed>>, type: string, amount: number) => {
    const normalizedType = normalizeText(type);
    if (!normalizedType || amount <= 0) return;
    seed.totals[normalizedType] = (seed.totals[normalizedType] || 0) + amount;
    if (/food/i.test(normalizedType)) seed.hasFood = true;
    if (/transport/i.test(normalizedType)) seed.hasTransport = true;
    if (/hostel/i.test(normalizedType)) {
      seed.hasHostel = true;
      seed.hostel_required = "Yes";
    }
    if (/entrance/i.test(normalizedType)) seed.hasEntrance = true;
  };

  for (const row of transactions.rows) {
    const seed = ensureSeed(resolveLegacyRegNo(row.reg_no, row.description));
    if (!seed) continue;
    seed.name ||= normalizeText(row.name);
    seed.phone ||= "";
    seed.course_year ||= normalizeText(row.mapped_course_year);
    seed.stream = normalizeText(row.mapped_stream) || seed.stream;
    markFeeUsage(seed, row.transaction_type, toNumber(row.credit_amount));
  }

  for (const row of oldDue.rows) {
    const seed = ensureSeed(resolveLegacyRegNo(row.reg_no, row.legacy_student_id));
    if (!seed) continue;
    seed.name ||= normalizeText(row.name);
    seed.phone ||= normalizePhone(row.phone);
    seed.course_year ||= normalizeText(row.mapped_course_year);
    seed.stream = normalizeText(row.mapped_stream) || seed.stream;
    markFeeUsage(seed, row.category, toNumber(row.due_amount));
  }

  for (const row of admissionDue.rows) {
    const seed = ensureSeed(resolveLegacyRegNo(row.reg_no, row.name, row.father_name));
    if (!seed) continue;
    seed.name ||= normalizeText(row.name);
    seed.father_name ||= normalizeText(row.father_name);
    seed.phone ||= normalizePhone(row.phone);
    seed.course_year ||= normalizeText(row.mapped_course_year);
    seed.stream = normalizeText(row.mapped_stream) || seed.stream;
    markFeeUsage(seed, "Admission Fee", toNumber(row.due_amount));
  }

  for (const row of installmentDue.rows) {
    const seed = ensureSeed(resolveLegacyRegNo(row.reg_no));
    if (!seed) continue;
    seed.name ||= normalizeText(row.name);
    seed.phone ||= normalizePhone(row.parent_phone);
    seed.course_year ||= normalizeText(row.mapped_course_year);
    seed.stream = normalizeText(row.mapped_stream) || seed.stream;
    seed.session ||= normalizeText(row.mapped_session);
    if (normalizeYesNo(row.hostel_status, "No") === "Yes") {
      seed.hostel_required = "Yes";
      seed.hasHostel = true;
    }
    markFeeUsage(seed, "Installment Due", toNumber(row.total_due));
  }

  return seeds;
}

async function insertReferenceData(
  students: SnapshotStudents,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
  transactions: SnapshotTransactions,
) {
  const classNames = buildClassList(students, oldDue, admissionDue, installmentDue, transactions);
  const streamNames = buildStreamList(students, oldDue, admissionDue, installmentDue, transactions);
  const sessionNames = buildSessionList(students, installmentDue);

  const classDocs = classNames.map((name, index) => ({ id: index + 1, name, batch_names: [] as string[] }));
  const streamDocs = streamNames.map((name, index) => ({ id: index + 1, name, active: true }));
  const sessionDocs = sessionNames.map((name, index) => ({ id: index + 1, name, active: true }));

  if (classDocs.length) await ClassModel.insertMany(classDocs);
  if (streamDocs.length) await StreamMaster.insertMany(streamDocs);
  if (sessionDocs.length) await AcademicSessionMaster.insertMany(sessionDocs);

  const classIdByName = new Map(classDocs.map((doc) => [doc.name, doc.id]));

  const ledgerNames = Array.from(
    new Set(
      [
        ...transactions.rows.map((row) => normalizeText(row.transaction_type)),
        ...oldDue.rows.map((row) => normalizeText(row.category)),
        ...admissionDue.rows.map(() => "Admission Fee"),
        ...installmentDue.rows.map(() => "Installment Due"),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const ledgers = ledgerNames.map((name, index) => ({
    id: index + 1,
    name,
    description: `Imported from old ERP: ${name}`,
    active: true,
  }));
  if (ledgers.length) {
    await FeeLedger.insertMany(ledgers);
  }

  return { classIdByName };
}

async function insertStudents(
  classIdByName: Map<string, number>,
  students: SnapshotStudents,
  transactions: SnapshotTransactions,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
) {
  const seedMap = buildStudentSeedMap(students, transactions, oldDue, admissionDue, installmentDue);
  const docs = Array.from(seedMap.values()).map((seed, index) => ({
    id: index + 1,
    name: seed.name || seed.reg_no,
    father_name: seed.father_name,
    mother_name: seed.mother_name,
    phone: seed.phone,
    father_phone: seed.father_phone,
    mother_phone: seed.mother_phone,
    address: seed.address,
    post: "",
    pin_code: seed.pin_code,
    thana: "",
    country: "India",
    state: "Odisha",
    district: seed.district || "Ganjam",
    landmark: "",
    email: "",
    dob: seed.dob,
    age: "",
    gender: seed.gender || "Male",
    class_id: classIdByName.get(seed.course_year || "1st Year") || 1,
    section: "",
    session: seed.session || "2025-2027",
    category: "General",
    student_group: "None",
    stream: seed.stream || "None",
    occupation: "",
    admission_date: seed.admission_date || "2025-01-01",
    reg_no: seed.reg_no,
    photo_url: seed.photo_url,
    roll_no: "",
    rfid_card_no: seed.rfid_card_no,
    hostel_required: seed.hostel_required,
    hostel_fee: seed.totals["Hostel Fee"] || 0,
    student_aadhaar_no: "",
    mother_aadhaar_no: "",
    father_aadhaar_no: "",
    bank_name: "",
    account_no: "",
    ifsc: "",
    guardian1_relation: "",
    guardian1_mobile: "",
    guardian1_name: "",
    guardian1_address: "",
    guardian1_aadhaar_no: "",
    guardian2_relation: "",
    guardian2_mobile: "",
    guardian2_name: "",
    guardian2_address: "",
    guardian2_aadhaar_no: "",
    coaching_fee: seed.totals["Coatching Fee"] || 0,
    admission_fee: seed.totals["Admission Fee"] || 0,
    transport: seed.hasTransport ? "Yes" : "No",
    transport_fee: seed.totals["Transport Fee"] || 0,
    entrance: seed.hasEntrance ? "Yes" : "No",
    entrance_fee: seed.totals["Entrance Fee"] || 0,
    fooding: seed.hasFood ? "Yes" : "No",
    fooding_fee: seed.totals["Food Fee"] || 0,
    status: seed.status || "active",
  }));

  if (docs.length) {
    await Student.insertMany(docs);
  }

  return new Map(docs.map((doc) => [doc.reg_no, doc]));
}

function buildPaidFeeDocs(transactions: SnapshotTransactions, studentByRegNo: Map<string, any>) {
  let nextFeeId = 1;
  let nextTransactionId = 1;
  const feeDocs: any[] = [];
  const transactionDocs: any[] = [];

  for (const row of transactions.rows) {
    const regNo = resolveLegacyRegNo(row.reg_no, row.description);
    const student = studentByRegNo.get(regNo);
    if (!student) {
      continue;
    }

    if (toNumber(row.credit_amount) > 0) {
      feeDocs.push({
        id: nextFeeId++,
        student_id: student.id,
        academic_session: student.session,
        class_id: student.class_id,
        amount: toNumber(row.credit_amount),
        type: normalizeText(row.transaction_type) || "Fee Collection",
        date: toIsoDate(row.date) || "2025-01-01",
        status: normalizeText(row.status).toLowerCase() === "cancelled" ? "cancelled" : "paid",
        discount: 0,
        mode: normalizeText(row.mode) || "Cash",
        reference_no: `Legacy transaction ${normalizeText(row.legacy_transaction_id)}`,
        remark: normalizeText(row.description),
        bill_no: normalizeText(row.legacy_transaction_id) || String(row.serial_no),
      });
    }

    const transactionAmount = toNumber(row.credit_amount) - toNumber(row.debit_amount);
    if (transactionAmount !== 0) {
      transactionDocs.push({
        id: nextTransactionId++,
        student_id: student.id,
        amount: Math.abs(transactionAmount),
        type: transactionAmount >= 0 ? "credit" : "debit",
        category: normalizeText(row.transaction_type) || "Legacy Transaction",
        date: toIsoDate(row.date) || "2025-01-01",
        description: normalizeText(row.description) || `Legacy transaction ${normalizeText(row.legacy_transaction_id)}`,
      });
    }
  }

  return { feeDocs, transactionDocs, nextFeeId, nextTransactionId };
}

function appendPendingFeeDocs(
  feeDocs: any[],
  nextFeeIdStart: number,
  studentByRegNo: Map<string, any>,
  oldDue: SnapshotOldDue,
  admissionDue: SnapshotAdmissionDue,
  installmentDue: SnapshotInstallmentDue,
) {
  let nextFeeId = nextFeeIdStart;

  for (const row of oldDue.rows) {
    const student = studentByRegNo.get(resolveLegacyRegNo(row.reg_no, row.legacy_student_id));
    if (!student) continue;
    feeDocs.push({
      id: nextFeeId++,
      student_id: student.id,
      academic_session: student.session,
      class_id: student.class_id,
      amount: toNumber(row.due_amount),
      type: normalizeText(row.category) || "Old Due",
      date: "2026-04-26",
      status: "pending",
      discount: 0,
      mode: "Cash",
      reference_no: "Imported from legacy old due report",
      remark: `Legacy old due import for ${normalizeText(row.legacy_student_id)}`,
      bill_no: `OLDDUE-${normalizeUpper(row.reg_no)}-${nextFeeId}`,
    });
  }

  for (const row of admissionDue.rows) {
    const student = studentByRegNo.get(resolveLegacyRegNo(row.reg_no));
    if (!student) continue;
    feeDocs.push({
      id: nextFeeId++,
      student_id: student.id,
      academic_session: student.session,
      class_id: student.class_id,
      amount: toNumber(row.due_amount),
      type: "Admission Fee",
      date: "2026-04-26",
      status: "pending",
      discount: 0,
      mode: "Cash",
      reference_no: "Imported from legacy admission due report",
      remark: `Legacy admission due import`,
      bill_no: `ADMDUE-${normalizeUpper(row.reg_no)}-${nextFeeId}`,
    });
  }

  for (const row of installmentDue.rows) {
    const student = studentByRegNo.get(resolveLegacyRegNo(row.reg_no));
    if (!student) continue;
    feeDocs.push({
      id: nextFeeId++,
      student_id: student.id,
      academic_session: normalizeText(row.mapped_session) || student.session,
      class_id: student.class_id,
      amount: toNumber(row.total_due),
      type: "Installment Due",
      date: "2026-04-26",
      status: "pending",
      discount: 0,
      mode: "Cash",
      reference_no: "Imported from legacy installment due report",
      remark: `Legacy installment due import`,
      bill_no: `INSTDUE-${normalizeUpper(row.reg_no)}-${nextFeeId}`,
    });
  }

  return nextFeeId;
}

async function seedCounters() {
  for (const [name, model] of COUNTER_SEEDS) {
    const highest = await model.findOne().sort({ id: -1 }).lean();
    await Counter.create({ name, seq: Number(highest?.id || 0) });
  }
}

async function verifyImport(expected: {
  students: SnapshotStudents;
  transactions: SnapshotTransactions;
  oldDue: SnapshotOldDue;
  admissionDue: SnapshotAdmissionDue;
  installmentDue: SnapshotInstallmentDue;
}) {
  const [
    studentCount,
    feeCount,
    transactionCount,
    pendingOldDueTotal,
    pendingAdmissionDueTotal,
    pendingInstallmentDueTotal,
  ] = await Promise.all([
    Student.countDocuments(),
    Fee.countDocuments(),
    Transaction.countDocuments(),
    Fee.aggregate([
      { $match: { status: "pending", reference_no: "Imported from legacy old due report" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Fee.aggregate([
      { $match: { status: "pending", reference_no: "Imported from legacy admission due report" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Fee.aggregate([
      { $match: { status: "pending", reference_no: "Imported from legacy installment due report" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    students: {
      imported: studentCount,
      extracted_rows: new Set(
        expected.students.categories.flatMap((category) => category.rows.map((row) => normalizeUpper(row.reg_no || row.legacy_student_id))),
      ).size,
    },
    transactions: {
      imported: transactionCount,
      extracted_rows: expected.transactions.total_rows,
    },
    fees: {
      imported: feeCount,
      paid_transaction_rows: expected.transactions.total_rows,
      old_due_total: Number(pendingOldDueTotal[0]?.total || 0),
      old_due_expected: expected.oldDue.total_due_amount,
      admission_due_total: Number(pendingAdmissionDueTotal[0]?.total || 0),
      admission_due_expected: expected.admissionDue.total_due_amount,
      installment_due_total: Number(pendingInstallmentDueTotal[0]?.total || 0),
      installment_due_expected: expected.installmentDue.total_due_amount,
    },
  };
}

async function runImport(options: ImportOptions) {
  const students = await readJsonFile<SnapshotStudents>(path.join(TMP_DIR, "old-erp-students.json"));
  const transactions = await readJsonFile<SnapshotTransactions>(path.join(TMP_DIR, "old-erp-transactions.json"));
  const oldDue = await readJsonFile<SnapshotOldDue>(path.join(TMP_DIR, "old-erp-old-due.json"));
  const admissionDue = await readJsonFile<SnapshotAdmissionDue>(path.join(TMP_DIR, "old-erp-admission-due.json"));
  const installmentDue = await readJsonFile<SnapshotInstallmentDue>(path.join(TMP_DIR, "old-erp-installment-due.json"));

  const studentSeedPreview = buildStudentSeedMap(students, transactions, oldDue, admissionDue, installmentDue);
  const preview = {
    classes: buildClassList(students, oldDue, admissionDue, installmentDue, transactions).length,
    streams: buildStreamList(students, oldDue, admissionDue, installmentDue, transactions).length,
    sessions: buildSessionList(students, installmentDue).length,
    unique_students: studentSeedPreview.size,
    paid_rows: transactions.total_rows,
    old_due_rows: oldDue.total_rows,
    admission_due_rows: admissionDue.total_rows,
    installment_due_rows: installmentDue.total_rows,
  };

  if (options.dryRun) {
    return { dry_run: true, preview };
  }

  const backupPath = options.skipBackup ? null : await backupExistingCollections(options.backupDir);
  await resetCollections();
  const { classIdByName } = await insertReferenceData(students, oldDue, admissionDue, installmentDue, transactions);
  const studentByRegNo = await insertStudents(classIdByName, students, transactions, oldDue, admissionDue, installmentDue);
  const { feeDocs, transactionDocs, nextFeeId } = buildPaidFeeDocs(transactions, studentByRegNo);
  appendPendingFeeDocs(feeDocs, nextFeeId, studentByRegNo, oldDue, admissionDue, installmentDue);

  if (feeDocs.length) await Fee.insertMany(feeDocs);
  if (transactionDocs.length) await Transaction.insertMany(transactionDocs);

  await seedCounters();

  const verification = await verifyImport({ students, transactions, oldDue, admissionDue, installmentDue });
  return {
    dry_run: false,
    backup_path: backupPath,
    preview,
    verification,
  };
}

async function main() {
  const command = process.argv[2] || "dry-run";
  const options: ImportOptions = {
    dryRun: command !== "import",
    skipBackup: process.argv.includes("--skip-backup"),
    backupDir: process.argv.includes("--backup-dir")
      ? path.resolve(process.argv[process.argv.indexOf("--backup-dir") + 1] || TMP_DIR)
      : TMP_DIR,
  };

  await connectToDatabase();
  const result = await runImport(options);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
