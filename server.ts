import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectToDatabase } from "./server/database.ts";
import {
  Attendance,
  ClassModel,
  Exam,
  Fee,
  FeeStructure,
  FeeLedger,
  FoodTransaction,
  FoodWallet,
  Hostel,
  HostelAllotment,
  Mark,
  Room,
  Student,
  Subject,
  Transaction,
  User,
  AcademicSessionMaster,
  StreamMaster,
  AuditLog,
  getNextSequence,
} from "./server/models.ts";

try {
  dotenv.config({ path: ".env.local", override: true });
  dotenv.config();
} catch (e) {
  console.log("Dotenv load skipped or failed - relying on system environment variables.");
}

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const PORT = Number(process.env.PORT || 3000);
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "";
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "";
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || "svm-erp/students";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const DIST_INDEX = path.join(DIST_DIR, "index.html");

function stripMongoFields<T extends Record<string, unknown>>(doc: T | null | undefined) {
  if (!doc) {
    return null;
  }

  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}

function dateString(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function formatAppBillNo(feeId: number) {
  return `SVM-${String(feeId).padStart(6, "0")}`;
}

function summarizeChangedFields(before: Record<string, any> | null | undefined, after: Record<string, any> | null | undefined) {
  if (!before || !after) return [];
  const ignored = new Set(["_id"]);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !ignored.has(key))
    .filter((key) => JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));
}

function computeDynamicFees(student: any, feeStructures: any[]) {
  const rules = feeStructures.filter(
    (s) => s.academic_session === student.session && s.class_id === student.class_id && s.stream === student.stream
  );

  let admission_amount = 0;
  let coaching_amount = 0;
  let transport_amount = 0;
  let entrance_amount = 0;
  let fooding_amount = 0;

  rules.forEach((r) => {
    const type = String(r.fee_type).toLowerCase();
    if (type.includes("admission")) admission_amount += Number(r.amount) || 0;
    else if (type.includes("coaching") || type.includes("tuition")) coaching_amount += Number(r.amount) || 0;
    else if (type.includes("transport")) transport_amount += Number(r.amount) || 0;
    else if (type.includes("entrance")) entrance_amount += Number(r.amount) || 0;
    else if (type.includes("food")) fooding_amount += Number(r.amount) || 0;
  });

  const hasAdmission = rules.some((r) => String(r.fee_type).toLowerCase().includes("admission"));
  const hasCoaching = rules.some((r) => String(r.fee_type).toLowerCase().includes("coaching") || String(r.fee_type).toLowerCase().includes("tuition"));
  const hasTransport = rules.some((r) => String(r.fee_type).toLowerCase().includes("transport"));
  const hasEntrance = rules.some((r) => String(r.fee_type).toLowerCase().includes("entrance"));
  const hasFooding = rules.some((r) => String(r.fee_type).toLowerCase().includes("food"));

  return {
    dynamic_admission_fee: hasAdmission ? admission_amount : Number(student.admission_fee || 0),
    dynamic_coaching_fee: hasCoaching ? coaching_amount : Number(student.coaching_fee || 0),
    dynamic_transport_fee: student.transport === "Yes" ? (hasTransport ? transport_amount : Number(student.transport_fee || 0)) : 0,
    dynamic_entrance_fee: student.entrance === "Yes" ? (hasEntrance ? entrance_amount : Number(student.entrance_fee || 0)) : 0,
    dynamic_fooding_fee: student.fooding === "Yes" ? (hasFooding ? fooding_amount : Number(student.fooding_fee || 0)) : 0,
  };
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeAcademicClassName(value: unknown) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
}

function getAcademicSessionStartYear(value: unknown) {
  const match = /^(\d{4})-\d{4}$/.exec(String(value || "").trim());
  return match ? Number(match[1]) : 0;
}

function getCollegeYearRank(className: unknown) {
  const normalized = normalizeAcademicClassName(className);
  if (/\b(XI|1ST YEAR|FIRST YEAR)\b/.test(normalized)) return 1;
  if (/\b(XII|2ND YEAR|SECOND YEAR)\b/.test(normalized)) return 2;
  return 0;
}

function getCollegeStreamName(className: unknown) {
  const normalized = normalizeAcademicClassName(className);
  if (normalized.includes("ARTS")) return "ARTS";
  if (normalized.includes("SC") || normalized.includes("SCIENCE")) return "SCIENCE";
  return "";
}

function getCollegeStreamLabel(className: unknown) {
  const stream = getCollegeStreamName(className);
  if (stream === "ARTS") return "Arts";
  if (stream === "SCIENCE") return "Science";
  return "None";
}

function isAcademicCollegeClass(className: unknown) {
  return Boolean(getCollegeYearRank(className) && getCollegeStreamName(className));
}

function isOlderAcademicBucket(
  candidateSession: unknown,
  candidateClassName: unknown,
  currentSession: unknown,
  currentClassName: unknown,
) {
  const candidateYear = getAcademicSessionStartYear(candidateSession);
  const currentYear = getAcademicSessionStartYear(currentSession);
  if (candidateYear && currentYear && candidateYear < currentYear) {
    return true;
  }
  if (candidateYear && currentYear && candidateYear > currentYear) {
    return false;
  }

  const candidateRank = getCollegeYearRank(candidateClassName);
  const currentRank = getCollegeYearRank(currentClassName);
  const candidateStream = getCollegeStreamName(candidateClassName);
  const currentStream = getCollegeStreamName(currentClassName);

  if (candidateRank && currentRank) {
    if (candidateStream && currentStream && candidateStream === currentStream) {
      return candidateRank < currentRank;
    }
    return candidateRank < currentRank;
  }

  return false;
}

function getPromotableTargetClassName(className: unknown) {
  const normalized = normalizeAcademicClassName(className);
  if (normalized === "XI ARTS") return "XII ARTS";
  if (normalized === "XI SC" || normalized === "XI SCIENCE") return "XII SC";
  return "";
}

function isCloudinaryConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET);
}

function createCloudinarySignature(params: Record<string, string | number>) {
  const sortedEntries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const toSign = sortedEntries.map(([key, value]) => `${key}=${value}`).join("&");
  return crypto.createHash("sha1").update(`${toSign}${CLOUDINARY_API_SECRET}`).digest("hex");
}

async function buildStudentPayload(body: any, existingStatus?: string) {
  const classId = toNumber(body.class_id);
  const classDoc = classId ? await ClassModel.findOne({ id: classId }).lean() : null;
  const className = classDoc?.name || "";
  const normalizedClassName = normalizeAcademicClassName(className);
  const derivedStream = getCollegeStreamLabel(className);
  const requestedStatus = body.status || existingStatus || "active";

  if (classId && !classDoc) {
    throw new Error("Selected class was not found.");
  }

  if (requestedStatus !== "alumni" && normalizedClassName === "PASSED OUT") {
    throw new Error("Passed out class can only be used for alumni records.");
  }

  if (requestedStatus !== "alumni" && className && !isAcademicCollegeClass(className)) {
    throw new Error("Students can only be admitted into XI/XII Arts or Science classes.");
  }

  return {
    name: body.name,
    father_name: body.father_name || "",
    mother_name: body.mother_name || "",
    phone: body.phone || "",
    father_phone: body.father_phone || "",
    mother_phone: body.mother_phone || "",
    address: body.address || "",
    post: body.post || "",
    pin_code: body.pin_code || "",
    thana: body.thana || "",
    country: body.country || "",
    state: body.state || "",
    district: body.district || "",
    landmark: body.landmark || "",
    email: body.email || "",
    dob: body.dob || "",
    age: body.age || "",
    gender: body.gender || "Male",
    class_id: classId,
    section: body.section || "",
    session: body.session || "",
    category: body.category || "General",
    student_group: derivedStream !== "None" ? derivedStream : body.student_group || "None",
    stream: derivedStream !== "None" ? derivedStream : body.stream || "None",
    occupation: body.occupation || "",
    admission_date: body.admission_date || dateString(),
    reg_no: body.reg_no,
    photo_url: body.photo_url || "",
    roll_no: body.roll_no || "",
    rfid_card_no: body.rfid_card_no || "",
    hostel_required: body.hostel_required || "No",
    student_aadhaar_no: body.student_aadhaar_no || "",
    mother_aadhaar_no: body.mother_aadhaar_no || "",
    father_aadhaar_no: body.father_aadhaar_no || "",
    bank_name: body.bank_name || "",
    account_no: body.account_no || "",
    ifsc: body.ifsc || "",
    guardian1_relation: body.guardian1_relation || "",
    guardian1_mobile: body.guardian1_mobile || "",
    guardian1_name: body.guardian1_name || "",
    guardian1_address: body.guardian1_address || "",
    guardian1_aadhaar_no: body.guardian1_aadhaar_no || "",
    guardian2_relation: body.guardian2_relation || "",
    guardian2_mobile: body.guardian2_mobile || "",
    guardian2_name: body.guardian2_name || "",
    guardian2_address: body.guardian2_address || "",
    guardian2_aadhaar_no: body.guardian2_aadhaar_no || "",
    coaching_fee: toNumber(body.coaching_fee),
    admission_fee: toNumber(body.admission_fee),
    transport: body.transport || "No",
    transport_fee: toNumber(body.transport_fee),
    entrance: body.entrance || "No",
    entrance_fee: toNumber(body.entrance_fee),
    fooding: body.fooding || "No",
    fooding_fee: toNumber(body.fooding_fee),
    status: body.status || existingStatus || "active",
  };
}

function buildClassMap(classes: Array<Record<string, unknown>>) {
  return new Map(classes.map((item) => [item.id, item.name]));
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  };

  async function writeAuditLog(req: any, input: {
    action: string;
    entity: string;
    entity_id?: string | number;
    summary?: string;
    before?: unknown;
    after?: unknown;
  }) {
    try {
      const id = await getNextSequence("audit_logs");
      await AuditLog.create({
        id,
        user_id: toNumber(req.user?.id),
        username: req.user?.username || "",
        role: req.user?.role || "",
        action: input.action,
        entity: input.entity,
        entity_id: String(input.entity_id ?? ""),
        summary: input.summary || "",
        before: input.before ?? null,
        after: input.after ?? null,
        date: dateString(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Audit log write failed", error);
    }
  }

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).lean();

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      },
    });
  });

  app.get("/api/admin/audit-logs", authenticateToken, requireAdmin, async (req, res) => {
    const limit = Math.min(toNumber(req.query.limit) || 80, 250);
    const logs = await AuditLog.find().sort({ id: -1 }).limit(limit).lean();
    res.json(logs.map((item) => stripMongoFields(item)));
  });

  app.get("/api/admin/backup", authenticateToken, requireAdmin, async (req, res) => {
    const [
      students,
      fees,
      transactions,
      classes,
      ledgers,
      structures,
      sessions,
      streams,
      subjects,
      exams,
      marks,
      users,
    ] = await Promise.all([
      Student.find().lean(),
      Fee.find().lean(),
      Transaction.find().lean(),
      ClassModel.find().lean(),
      FeeLedger.find().lean(),
      FeeStructure.find().lean(),
      AcademicSessionMaster.find().lean(),
      StreamMaster.find().lean(),
      Subject.find().lean(),
      Exam.find().lean(),
      Mark.find().lean(),
      User.find().select("-password").lean(),
    ]);

    await writeAuditLog(req, {
      action: "export",
      entity: "backup",
      summary: "Exported production backup JSON",
    });

    res.setHeader("content-type", "application/json");
    res.setHeader("content-disposition", `attachment; filename="svm-erp-backup-${dateString()}.json"`);
    res.send(JSON.stringify({
      exported_at: new Date().toISOString(),
      students,
      fees,
      transactions,
      classes,
      fee_ledgers: ledgers,
      fee_structures: structures,
      sessions,
      streams,
      subjects,
      exams,
      marks,
      users,
    }, null, 2));
  });

  app.get("/api/admin/data-health", authenticateToken, requireAdmin, async (_req, res) => {
    const [classes, students, fees, ledgers] = await Promise.all([
      ClassModel.find().lean(),
      Student.find().lean(),
      Fee.find().lean(),
      FeeLedger.find().lean(),
    ]);
    const classIds = new Set(classes.map((item) => Number(item.id)));
    const studentIds = new Set(students.map((item) => Number(item.id)));
    const regCounts = new Map<string, number>();
    const billCounts = new Map<string, number>();
    students.forEach((student) => {
      const regNo = String(student.reg_no || "").trim().toUpperCase();
      if (regNo) regCounts.set(regNo, (regCounts.get(regNo) || 0) + 1);
    });
    fees.forEach((fee) => {
      const billNo = String(fee.bill_no || "").trim().toUpperCase();
      if (billNo) billCounts.set(billNo, (billCounts.get(billNo) || 0) + 1);
    });

    const duplicateRegNos = [...regCounts.entries()].filter(([, count]) => count > 1);
    const duplicateBillNos = [...billCounts.entries()].filter(([, count]) => count > 1);
    const missingClassStudents = students.filter((student) => !classIds.has(Number(student.class_id)));
    const missingSessionStudents = students.filter((student) => !String(student.session || "").trim());
    const orphanFees = fees.filter((fee) => !studentIds.has(Number(fee.student_id)));
    const brokenPhotoUrls = students.filter((student) => {
      const value = String(student.photo_url || "");
      return value && !/^https:\/\/res\.cloudinary\.com\//i.test(value);
    });
    const duplicateFeeGroups = await Fee.aggregate([
      {
        $group: {
          _id: {
            student_id: "$student_id",
            status: "$status",
            type: "$type",
            amount: "$amount",
            academic_session: "$academic_session",
            class_id: "$class_id",
            date: "$date",
          },
          count: { $sum: 1 },
          bill_nos: { $push: "$bill_no" },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const issues = [
      { label: "Duplicate registration numbers", count: duplicateRegNos.length, severity: duplicateRegNos.length ? "high" : "ok" },
      { label: "Duplicate bill numbers", count: duplicateBillNos.length, severity: duplicateBillNos.length ? "high" : "ok" },
      { label: "Students with missing class", count: missingClassStudents.length, severity: missingClassStudents.length ? "high" : "ok" },
      { label: "Students with missing session", count: missingSessionStudents.length, severity: missingSessionStudents.length ? "medium" : "ok" },
      { label: "Fee rows without matching student", count: orphanFees.length, severity: orphanFees.length ? "high" : "ok" },
      { label: "Non-Cloudinary photo URLs", count: brokenPhotoUrls.length, severity: brokenPhotoUrls.length ? "medium" : "ok" },
      { label: "Suspicious duplicate fee groups", count: duplicateFeeGroups.length, severity: duplicateFeeGroups.length ? "medium" : "ok" },
    ];

    res.json({
      checked_at: new Date().toISOString(),
      totals: {
        students: students.length,
        fees: fees.length,
        ledgers: ledgers.length,
        classes: classes.length,
      },
      issues,
      samples: {
        duplicate_reg_nos: duplicateRegNos.slice(0, 10).map(([reg_no, count]) => ({ reg_no, count })),
        duplicate_bill_nos: duplicateBillNos.slice(0, 10).map(([bill_no, count]) => ({ bill_no, count })),
        missing_class_students: missingClassStudents.slice(0, 10).map((student) => ({ id: student.id, name: student.name, reg_no: student.reg_no })),
        missing_session_students: missingSessionStudents.slice(0, 10).map((student) => ({ id: student.id, name: student.name, reg_no: student.reg_no })),
        orphan_fees: orphanFees.slice(0, 10).map((fee) => ({ id: fee.id, bill_no: fee.bill_no, student_id: fee.student_id })),
        broken_photo_urls: brokenPhotoUrls.slice(0, 10).map((student) => ({ id: student.id, name: student.name, reg_no: student.reg_no })),
        duplicate_fee_groups: duplicateFeeGroups,
      },
    });
  });

  app.get("/api/admin/fee-reconciliation", authenticateToken, requireAdmin, async (_req, res) => {
    const [students, fees, classes, structures] = await Promise.all([
      Student.find().lean(),
      Fee.find().lean(),
      ClassModel.find().lean(),
      FeeStructure.find().lean(),
    ]);
    const classNameById = new Map(classes.map((item) => [Number(item.id), String(item.name || "")]));
    const feesByStudent = new Map<number, any[]>();
    fees.forEach((fee) => {
      const rows = feesByStudent.get(Number(fee.student_id)) || [];
      rows.push(fee);
      feesByStudent.set(Number(fee.student_id), rows);
    });

    const rows = students.map((student) => {
      const studentFees = feesByStudent.get(Number(student.id)) || [];
      const structureTotal = structures
        .filter((rule) =>
          rule.academic_session === student.session &&
          Number(rule.class_id) === Number(student.class_id) &&
          String(rule.stream || "") === String(student.stream || ""),
        )
        .reduce((sum, rule) => sum + Number(rule.amount || 0), 0);
      const paid = studentFees.filter((fee) => fee.status === "paid").reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
      const pending = studentFees.filter((fee) => fee.status === "pending").reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
      const cancelled = studentFees.filter((fee) => fee.status === "cancelled").reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
      const discount = studentFees.reduce((sum, fee) => sum + Number(fee.discount || 0), 0);

      return {
        student_id: student.id,
        reg_no: student.reg_no,
        name: student.name,
        class_name: classNameById.get(Number(student.class_id)) || "",
        session: student.session,
        stream: student.stream,
        structure_total: structureTotal,
        paid,
        pending,
        cancelled,
        discount,
        balance_by_structure: Math.max(structureTotal - paid - discount, 0),
        ledger_balance: pending,
      };
    });

    res.json(rows);
  });

  app.get("/api/uploads/student-photo-signature", authenticateToken, async (_req, res) => {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({ error: "Cloudinary is not configured on the server" });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      folder: CLOUDINARY_FOLDER,
      timestamp,
    };

    res.json({
      cloudName: CLOUDINARY_CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      folder: CLOUDINARY_FOLDER,
      timestamp,
      signature: createCloudinarySignature(params),
    });
  });

  app.get("/api/stats", authenticateToken, async (_req, res) => {
    const today = dateString();
    const [totalStudents, activeStudents, todayFeesAgg, pendingFeesAgg, hostelStudents, recentTransactions, students, classes] =
      await Promise.all([
        Student.countDocuments(),
        Student.countDocuments({ status: "active" }),
        Fee.aggregate([
          { $match: { date: today } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Fee.aggregate([
          { $match: { status: "pending" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        HostelAllotment.countDocuments(),
        Transaction.find().sort({ date: -1, id: -1 }).limit(5).lean(),
        Student.find().lean(),
        ClassModel.find().lean(),
      ]);

    const studentMap = new Map<number, any>(students.map((student) => [student.id, student]));
    const classMap = new Map<number, string>(classes.map((item) => [item.id, item.name]));

    res.json({
      totalStudents,
      activeStudents,
      todayFees: todayFeesAgg[0]?.total || 0,
      pendingFees: pendingFeesAgg[0]?.total || 0,
      hostelStudents,
      recentTransactions: recentTransactions.map((item) => {
        const student = studentMap.get(item.student_id);
        return {
          ...stripMongoFields(item),
          student_name: student?.name || "Unknown Student",
          phone: student?.phone || "",
          class_name: classMap.get(student?.class_id) || "",
          fee_type: typeof item.description === "string" ? item.description.split(" - ")[0] : "",
        };
      }),
    });
  });

  app.get("/api/students", authenticateToken, async (_req, res) => {
    const [students, classes, feeStructures] = await Promise.all([
      Student.find().sort({ id: 1 }).lean(),
      ClassModel.find().lean(),
      FeeStructure.find().lean()
    ]);
    const classMap = buildClassMap(classes.map((item) => stripMongoFields(item) as Record<string, unknown>));

    res.json(
      students.map((student) => ({
        ...stripMongoFields(student),
        class_name: classMap.get(student.class_id) || "",
        dynamic_fees: computeDynamicFees(student, feeStructures)
      })),
    );
  });

  app.post("/api/students", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("students");
      const payload = {
        id,
        ...(await buildStudentPayload(req.body)),
      };

      const created = await Student.create(payload);
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/students/:id", authenticateToken, async (req, res) => {
    const student = await Student.findOne({ id: toNumber(req.params.id) }).lean();
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const classDoc = await ClassModel.findOne({ id: student.class_id }).lean();
    res.json({
      ...stripMongoFields(student),
      class_name: classDoc?.name || "",
    });
  });

  app.put("/api/students/:id", authenticateToken, async (req, res) => {
    try {
      const updated = await Student.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        await buildStudentPayload(req.body, "active"),
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/fees", authenticateToken, async (_req, res) => {
    const [fees, students] = await Promise.all([Fee.find().sort({ id: -1 }).lean(), Student.find().lean()]);
    const studentMap = new Map(students.map((item) => [item.id, item.name]));

    res.json(
      fees.map((fee) => ({
        ...stripMongoFields(fee),
        student_name: studentMap.get(fee.student_id) || "Unknown Student",
      })),
    );
  });

  app.post("/api/fees", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const classDocs = await ClassModel.find().lean();
      const classNameById = new Map(classDocs.map((item) => [item.id, item.name]));
      const pendingFeeIds = Array.isArray(req.body.pending_fee_ids)
        ? req.body.pending_fee_ids.map((value: unknown) => toNumber(value)).filter((value: number) => value > 0)
        : [];
      const paymentStatus = req.body.status || "paid";
      const paymentDate = req.body.date || dateString();
      const paymentMode = req.body.mode || "Cash";
      const paymentReference = req.body.reference_no || "";
      const paymentDiscount = toNumber(req.body.discount);
      const paymentAmount = toNumber(req.body.amount);

      if (pendingFeeIds.length > 0 && paymentStatus !== "pending") {
        const pendingFees = await Fee.find({
          id: { $in: pendingFeeIds },
          student_id: toNumber(req.body.student_id),
          status: "pending",
        })
          .sort({ id: 1 })
          .lean();

        if (pendingFees.length !== pendingFeeIds.length) {
          return res.status(404).json({ error: "One or more pending fees could not be found." });
        }

        const totalPendingAmount = pendingFees.reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        if (paymentAmount <= 0 || paymentAmount > totalPendingAmount) {
          return res.status(400).json({ error: "Payment amount must be greater than 0 and cannot exceed the selected pending dues." });
        }

        if (pendingFees.length > 1 && paymentDiscount > 0) {
          return res.status(400).json({ error: "Discount can only be applied when settling one pending fee at a time." });
        }

        const primaryFee = pendingFees[0];
        const otherPendingFees = await Fee.find({
          student_id: toNumber(req.body.student_id),
          status: "pending",
          id: { $nin: pendingFeeIds },
        }).lean();
        const primaryClassName = classNameById.get(Number(primaryFee.class_id)) || "";
        const blockingOlderDue = otherPendingFees.find((fee) =>
          isOlderAcademicBucket(
            fee.academic_session,
            classNameById.get(Number(fee.class_id)) || "",
            primaryFee.academic_session,
            primaryClassName,
          ),
        );

        if (blockingOlderDue) {
          return res.status(400).json({ error: "Cannot accept payment. Please clear older dues first." });
        }

        const updatedFee = await Fee.findOneAndUpdate(
          { id: primaryFee.id },
          {
            $set: {
              amount: paymentAmount,
              date: paymentDate,
              status: paymentStatus,
              discount: paymentDiscount,
              mode: paymentMode,
              reference_no: paymentReference,
            },
          },
          { returnDocument: "after" },
        ).lean();

        if (!updatedFee) {
          return res.status(404).json({ error: "Pending fee could not be updated." });
        }

        if (pendingFees.length > 1) {
          const remainingIds = pendingFees.slice(1).map((fee) => fee.id);
          await Fee.updateMany(
            { id: { $in: remainingIds } },
            {
              $set: {
                date: paymentDate,
                status: paymentStatus,
                mode: paymentMode,
                reference_no: paymentReference,
              },
            },
          );
        }

        const transactionId = await getNextSequence("transactions");
        await Transaction.create({
          id: transactionId,
          student_id: updatedFee.student_id,
          amount: paymentAmount,
          type: "credit",
          category: "fee",
          date: paymentDate,
          description: `Pending fee settled: ${updatedFee.type}${paymentMode ? ` (${paymentMode})` : ""}`,
        });
        await writeAuditLog(req, {
          action: "settle_pending_fee",
          entity: "fee",
          entity_id: updatedFee.id,
          summary: `Settled ${updatedFee.type} for student ${updatedFee.student_id}`,
          before: primaryFee,
          after: updatedFee,
        });

        return res.json({
          id: updatedFee.id,
          fee: {
            ...stripMongoFields(updatedFee),
            student_name: (await Student.findOne({ id: updatedFee.student_id }).lean())?.name || "Unknown Student",
          },
        });
      }

      const feeId = await getNextSequence("fees");
      const currentSession = req.body.academic_session || "";
      const currentClassId = toNumber(req.body.class_id) || 0;

      // Check for pending older dues before accepting current payment
      if (req.body.status !== "pending") {
        const student = await Student.findOne({ id: toNumber(req.body.student_id) }).lean();
        if (student) {
          const currentClassName = classNameById.get(currentClassId) || student.class_name || "";
          const oldDues = await Fee.find({
            student_id: student.id,
            status: "pending",
          }).lean();
          const hasBlockingOlderDue = oldDues.some((fee) =>
            isOlderAcademicBucket(
              fee.academic_session,
              classNameById.get(Number(fee.class_id)) || "",
              currentSession,
              currentClassName,
            ),
          );

          if (hasBlockingOlderDue) {
            return res.status(400).json({ error: "Cannot accept payment. Please clear older dues first." });
          }
        }
      }

      const payload = {
        id: feeId,
        student_id: toNumber(req.body.student_id),
        academic_session: currentSession,
        class_id: currentClassId,
        amount: paymentAmount,
        type: req.body.type || "Fee Collection",
        date: paymentDate,
        status: paymentStatus,
        discount: paymentDiscount,
        mode: paymentMode,
        reference_no: paymentReference,
        bill_no: String(req.body.bill_no || "").trim() || formatAppBillNo(feeId),
      };

      const fee = await Fee.create(payload);
      const transactionId = await getNextSequence("transactions");
      await Transaction.create({
        id: transactionId,
        student_id: payload.student_id,
        amount: payload.amount,
        type: "credit",
        category: "fee",
        date: payload.date,
        description: `Fee payment: ${payload.type}${payload.mode ? ` (${payload.mode})` : ""}`,
      });
      await writeAuditLog(req, {
        action: "create_fee_payment",
        entity: "fee",
        entity_id: fee.id,
        summary: `Created ${payload.type} payment ${payload.bill_no}`,
        after: fee.toObject(),
      });

      res.json({ id: fee.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/fees/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const feeId = toNumber(req.params.id);
      const updatedAmount = toNumber(req.body.amount);

      const beforeFee = await Fee.findOne({ id: feeId }).lean();
      const fee = await Fee.findOneAndUpdate(
        { id: feeId },
        { amount: updatedAmount },
        { returnDocument: "after" }
      ).lean();

      if (!fee) {
        return res.status(404).json({ error: "Fee not found" });
      }

      const transactionId = await getNextSequence("transactions");
      await Transaction.create({
        id: transactionId,
        student_id: fee.student_id,
        amount: updatedAmount,
        type: "update",
        category: "fee-adjustment",
        date: dateString(),
        description: `Fee amount manually adjusted: ${fee.type}`,
      });
      await writeAuditLog(req, {
        action: "update_fee_amount",
        entity: "fee",
        entity_id: fee.id,
        summary: `Updated ${fee.bill_no} amount to ${updatedAmount}`,
        before: beforeFee,
        after: fee,
      });

      res.json({ success: true, fee });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/classes", authenticateToken, async (_req, res) => {
    const classes = await ClassModel.find().sort({ id: 1 }).lean();
    res.json(classes.map((item) => stripMongoFields(item)));
  });

  app.get("/api/subjects", authenticateToken, async (_req, res) => {
    const [subjects, classes] = await Promise.all([Subject.find().sort({ id: 1 }).lean(), ClassModel.find().lean()]);
    const classMap = buildClassMap(classes.map((item) => stripMongoFields(item) as Record<string, unknown>));

    res.json(
      subjects.map((subject) => ({
        ...stripMongoFields(subject),
        class_name: classMap.get(subject.class_id) || "",
      })),
    );
  });

  app.post("/api/subjects", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("subjects");
      const created = await Subject.create({
        id,
        name: req.body.name,
        class_id: toNumber(req.body.class_id),
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/subjects/:id", authenticateToken, async (req, res) => {
    try {
      const updated = await Subject.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        {
          name: req.body.name,
          class_id: toNumber(req.body.class_id),
        },
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: "Subject not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/subjects/:id", authenticateToken, async (req, res) => {
    const subjectId = toNumber(req.params.id);
    const deleted = await Subject.findOneAndDelete({ id: subjectId }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await Mark.deleteMany({ subject_id: subjectId });
    res.json({ success: true });
  });

  app.get("/api/exams", authenticateToken, async (_req, res) => {
    const [exams, classes] = await Promise.all([Exam.find().sort({ date: -1, id: -1 }).lean(), ClassModel.find().lean()]);
    const classMap = buildClassMap(classes.map((item) => stripMongoFields(item) as Record<string, unknown>));

    res.json(
      exams.map((exam) => ({
        ...stripMongoFields(exam),
        class_name: classMap.get(exam.class_id) || "",
      })),
    );
  });

  app.post("/api/exams", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("exams");
      const created = await Exam.create({
        id,
        name: req.body.name,
        date: req.body.date || dateString(),
        class_id: toNumber(req.body.class_id),
        subject_max_marks: Array.isArray(req.body.subject_max_marks) ? req.body.subject_max_marks : [],
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/exams/:id", authenticateToken, async (req, res) => {
    try {
      const updated = await Exam.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        {
          name: req.body.name,
          date: req.body.date,
          class_id: toNumber(req.body.class_id),
          subject_max_marks: Array.isArray(req.body.subject_max_marks) ? req.body.subject_max_marks : [],
        },
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: "Exam not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/exams/:id", authenticateToken, async (req, res) => {
    const examId = toNumber(req.params.id);
    const deleted = await Exam.findOneAndDelete({ id: examId }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Exam not found" });
    }

    await Mark.deleteMany({ exam_id: examId });
    res.json({ success: true });
  });

  app.post("/api/marks", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("marks");
      const created = await Mark.create({
        id,
        student_id: toNumber(req.body.student_id),
        exam_id: toNumber(req.body.exam_id),
        subject_id: toNumber(req.body.subject_id),
        marks_obtained: toNumber(req.body.marks_obtained),
        max_marks: toNumber(req.body.max_marks),
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/marks/bulk", authenticateToken, async (req, res) => {
    try {
      const entries = Array.isArray(req.body.marks) ? req.body.marks : [];
      if (entries.length === 0) {
        return res.status(400).json({ error: "No marks provided" });
      }

      let count = 0;
      for (const entry of entries) {
        const studentId = toNumber(entry.student_id);
        const examId = toNumber(entry.exam_id);
        const subjectId = toNumber(entry.subject_id);

        const existing = await Mark.findOne({
          student_id: studentId,
          exam_id: examId,
          subject_id: subjectId,
        }).lean();

        if (existing) {
          await Mark.updateOne(
            { id: existing.id },
            {
              marks_obtained: toNumber(entry.marks_obtained),
              max_marks: toNumber(entry.max_marks),
            },
          );
        } else {
          const id = await getNextSequence("marks");
          await Mark.create({
            id,
            student_id: studentId,
            exam_id: examId,
            subject_id: subjectId,
            marks_obtained: toNumber(entry.marks_obtained),
            max_marks: toNumber(entry.max_marks),
          });
        }

        count += 1;
      }

      res.json({ success: true, count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/marks", authenticateToken, async (req, res) => {
    const examId = toNumber(req.query.exam_id);
    const studentId = toNumber(req.query.student_id);
    const filters: Record<string, unknown> = {};
    if (examId) {
      filters.exam_id = examId;
    }
    if (studentId) {
      filters.student_id = studentId;
    }

    const [marks, students, subjects, exams] = await Promise.all([
      Mark.find(filters).sort({ id: -1 }).lean(),
      Student.find().lean(),
      Subject.find().lean(),
      Exam.find().lean(),
    ]);

    const studentMap = new Map<number, any>(students.map((item) => [item.id, item]));
    const subjectMap = new Map<number, any>(subjects.map((item) => [item.id, item]));
    const examMap = new Map<number, any>(exams.map((item) => [item.id, item]));

    res.json(
      marks.map((mark) => ({
        ...stripMongoFields(mark),
        student_name: studentMap.get(mark.student_id)?.name || "",
        reg_no: studentMap.get(mark.student_id)?.reg_no || "",
        subject_name: subjectMap.get(mark.subject_id)?.name || "",
        exam_name: examMap.get(mark.exam_id)?.name || "",
      })),
    );
  });

  app.get("/api/hostels", authenticateToken, async (_req, res) => {
    const hostels = await Hostel.find().sort({ id: 1 }).lean();
    res.json(hostels.map((item) => stripMongoFields(item)));
  });

  app.post("/api/hostels", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("hostels");
      const created = await Hostel.create({
        id,
        name: req.body.name,
        type: req.body.type,
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/rooms", authenticateToken, async (_req, res) => {
    const [rooms, hostels] = await Promise.all([Room.find().sort({ id: 1 }).lean(), Hostel.find().lean()]);
    const hostelMap = new Map(hostels.map((item) => [item.id, item.name]));

    res.json(
      rooms.map((room) => ({
        ...stripMongoFields(room),
        hostel_name: hostelMap.get(room.hostel_id) || "",
      })),
    );
  });

  app.post("/api/rooms", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("rooms");
      const created = await Room.create({
        id,
        hostel_id: toNumber(req.body.hostel_id),
        room_no: req.body.room_no,
        capacity: toNumber(req.body.capacity),
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/hostel-allotments", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("hostelAllotments");
      const created = await HostelAllotment.create({
        id,
        student_id: toNumber(req.body.student_id),
        room_id: toNumber(req.body.room_id),
        bed_no: req.body.bed_no,
        start_date: req.body.start_date || dateString(),
        end_date: req.body.end_date || "",
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/reports/fee-pending", authenticateToken, async (_req, res) => {
    const [fees, students, classes] = await Promise.all([
      Fee.find({ status: { $ne: "cancelled" } }).lean(),
      Student.find().lean(),
      ClassModel.find().lean(),
    ]);
    const studentMap = new Map<number, any>(students.map((item) => [item.id, item]));
    const classMap = new Map<number, string>(classes.map((item) => [item.id, item.name]));
    const grouped = new Map<
      number,
      {
        name: string;
        reg_no: string;
        class_name: string;
        phone: string;
        total_amount: number;
        paid_amount: number;
        pending_amount: number;
      }
    >();

    for (const fee of fees) {
      const student = studentMap.get(fee.student_id) as any;
      if (!student) {
        continue;
      }

      const current = grouped.get(student.id) || {
        name: student.name,
        reg_no: student.reg_no,
        class_name: classMap.get(student.class_id) || "",
        phone: student.phone || "",
        total_amount: 0,
        paid_amount: 0,
        pending_amount: 0,
      };

      current.total_amount += fee.amount;
      if (fee.status === "paid") {
        current.paid_amount += fee.amount;
      } else if (fee.status === "pending") {
        current.pending_amount += fee.amount;
      }
      grouped.set(student.id, current);
    }

    res.json(Array.from(grouped.values()).filter((item) => item.pending_amount > 0));
  });

  app.get("/api/reports/collection", authenticateToken, async (req, res) => {
    const start = String(req.query.start || "0000-01-01");
    const end = String(req.query.end || "9999-12-31");
    const fees = await Fee.find({
      status: "paid",
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1, id: 1 })
      .lean();

    const grouped = new Map<string, number>();
    for (const fee of fees) {
      grouped.set(fee.date, (grouped.get(fee.date) || 0) + fee.amount);
    }

    res.json(
      Array.from(grouped.entries()).map(([date, total]) => ({
        date,
        total,
      })),
    );
  });

  app.get("/api/reports/students", authenticateToken, async (req, res) => {
    const filters: Record<string, unknown> = {};
    if (req.query.class_id) {
      filters.class_id = toNumber(req.query.class_id);
    }
    if (req.query.category) {
      filters.category = req.query.category;
    }
    if (req.query.student_group) {
      filters.student_group = req.query.student_group;
    }

    const [students, classes] = await Promise.all([
      Student.find(filters).sort({ id: 1 }).lean(),
      ClassModel.find().lean(),
    ]);
    const classMap = buildClassMap(classes.map((item) => stripMongoFields(item) as Record<string, unknown>));

    res.json(
      students.map((student) => ({
        ...stripMongoFields(student),
        class_name: classMap.get(student.class_id) || "",
      })),
    );
  });

  app.post("/api/attendance", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("attendance");
      const created = await Attendance.create({
        id,
        student_id: toNumber(req.body.student_id),
        date: req.body.date || dateString(),
        status: req.body.status,
      });
      res.json({ id: created.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/wallet/:student_id", authenticateToken, async (req, res) => {
    const wallet = await FoodWallet.findOne({ student_id: toNumber(req.params.student_id) }).lean();
    if (!wallet) {
      return res.json({ balance: 0 });
    }

    res.json(stripMongoFields(wallet));
  });

  app.post("/api/wallet/topup", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const studentId = toNumber(req.body.student_id);
      const amount = toNumber(req.body.amount);
      let wallet = await FoodWallet.findOne({ student_id: studentId });

      if (!wallet) {
        const walletId = await getNextSequence("foodWallets");
        wallet = await FoodWallet.create({
          id: walletId,
          student_id: studentId,
          balance: amount,
        });
      } else {
        wallet.balance += amount;
        await wallet.save();
      }

      const txId = await getNextSequence("foodTransactions");
      await FoodTransaction.create({
        id: txId,
        student_id: studentId,
        amount,
        type: "topup",
        date: dateString(),
      });

      res.json({ success: true, balance: wallet.balance });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/users", authenticateToken, requireAdmin, async (_req, res) => {
    const users = await User.find().sort({ id: 1 }).lean();
    res.json(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      })),
    );
  });

  app.post("/api/admin/users", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const password = await bcrypt.hash(req.body.password, 10);
      const id = await getNextSequence("users");
      const user = await User.create({
        id,
        username: req.body.username,
        password,
        role: req.body.role || "staff",
        name: req.body.name,
      });
      await writeAuditLog(req, {
        action: "create_user",
        entity: "user",
        entity_id: user.id,
        summary: `Created user ${user.username}`,
        after: { id: user.id, username: user.username, role: user.role, name: user.name },
      });

      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/users/:id", authenticateToken, requireAdmin, async (req: any, res) => {
    const userId = toNumber(req.params.id);
    if (req.user?.id === userId) {
      return res.status(400).json({ error: "You cannot delete the currently logged in admin" });
    }

    const deleted = await User.findOneAndDelete({ id: userId }).lean();
    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }
    await writeAuditLog(req, {
      action: "delete_user",
      entity: "user",
      entity_id: deleted.id,
      summary: `Deleted user ${deleted.username}`,
      before: { id: deleted.id, username: deleted.username, role: deleted.role, name: deleted.name },
    });

    res.json({ success: true });
  });

  app.get("/api/admin/classes", authenticateToken, requireAdmin, async (_req, res) => {
    const classes = await ClassModel.find().sort({ id: 1 }).lean();
    res.json(classes.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/classes", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = await getNextSequence("classes");
      const classDoc = await ClassModel.create({
        id,
        name: req.body.name,
        batch_names: Array.isArray(req.body.batch_names)
          ? req.body.batch_names.filter(Boolean)
          : [],
      });
      await writeAuditLog(req, {
        action: "create_class",
        entity: "class",
        entity_id: classDoc.id,
        summary: `Created class ${classDoc.name}`,
        after: classDoc.toObject(),
      });

      res.json(stripMongoFields(classDoc.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/classes/:id", authenticateToken, requireAdmin, async (req, res) => {
    const classId = toNumber(req.params.id);
    const deleted = await ClassModel.findOneAndDelete({ id: classId }).lean();

    if (!deleted) {
      return res.status(404).json({ error: "Class not found" });
    }
    
    // Also delete any subjects linked to this class
    await Subject.deleteMany({ class_id: classId });
    await writeAuditLog(req, {
      action: "delete_class",
      entity: "class",
      entity_id: deleted.id,
      summary: `Deleted class ${deleted.name}`,
      before: deleted,
    });

    res.json({ success: true });
  });

  app.get("/api/sessions", authenticateToken, async (_req, res) => {
    const sessions = await AcademicSessionMaster.find({ active: true }).sort({ name: 1 }).lean();
    res.json(sessions.map((item) => stripMongoFields(item)));
  });

  app.get("/api/admin/sessions", authenticateToken, requireAdmin, async (_req, res) => {
    const sessions = await AcademicSessionMaster.find().sort({ id: 1 }).lean();
    res.json(sessions.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/sessions", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = await getNextSequence("sessions");
      const session = await AcademicSessionMaster.create({
        id,
        name: req.body.name,
        active: req.body.active ?? true,
      });
      await writeAuditLog(req, {
        action: "create_session",
        entity: "session",
        entity_id: session.id,
        summary: `Created session ${session.name}`,
        after: session.toObject(),
      });
      res.json(stripMongoFields(session.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/sessions/:id", authenticateToken, requireAdmin, async (req, res) => {
    const deleted = await AcademicSessionMaster.findOneAndDelete({ id: toNumber(req.params.id) }).lean();
    if (!deleted) return res.status(404).json({ error: "Session not found" });
    await writeAuditLog(req, {
      action: "delete_session",
      entity: "session",
      entity_id: deleted.id,
      summary: `Deleted session ${deleted.name}`,
      before: deleted,
    });
    res.json({ success: true });
  });

  app.get("/api/streams", authenticateToken, async (_req, res) => {
    const streams = await StreamMaster.find({ active: true }).sort({ name: 1 }).lean();
    res.json(streams.map((item) => stripMongoFields(item)));
  });

  app.get("/api/admin/streams", authenticateToken, requireAdmin, async (_req, res) => {
    const streams = await StreamMaster.find().sort({ id: 1 }).lean();
    res.json(streams.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/streams", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = await getNextSequence("streams");
      const stream = await StreamMaster.create({
        id,
        name: req.body.name,
        active: req.body.active ?? true,
      });
      await writeAuditLog(req, {
        action: "create_stream",
        entity: "stream",
        entity_id: stream.id,
        summary: `Created stream ${stream.name}`,
        after: stream.toObject(),
      });
      res.json(stripMongoFields(stream.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/streams/:id", authenticateToken, requireAdmin, async (req, res) => {
    const deleted = await StreamMaster.findOneAndDelete({ id: toNumber(req.params.id) }).lean();
    if (!deleted) return res.status(404).json({ error: "Stream not found" });
    await writeAuditLog(req, {
      action: "delete_stream",
      entity: "stream",
      entity_id: deleted.id,
      summary: `Deleted stream ${deleted.name}`,
      before: deleted,
    });
    res.json({ success: true });
  });

  app.get("/api/fee-ledgers", authenticateToken, async (_req, res) => {
    const ledgers = await FeeLedger.find({ active: true }).sort({ name: 1 }).lean();
    res.json(ledgers.map((item) => stripMongoFields(item)));
  });

  app.get("/api/admin/fee-ledgers", authenticateToken, requireAdmin, async (_req, res) => {
    const ledgers = await FeeLedger.find().sort({ id: 1 }).lean();
    res.json(ledgers.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/fee-ledgers", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = await getNextSequence("feeLedgers");
      const ledger = await FeeLedger.create({
        id,
        name: req.body.name,
        description: req.body.description || "",
        active: req.body.active ?? true,
      });
      await writeAuditLog(req, {
        action: "create_fee_ledger",
        entity: "fee_ledger",
        entity_id: ledger.id,
        summary: `Created fee ledger ${ledger.name}`,
        after: ledger.toObject(),
      });

      res.json(stripMongoFields(ledger.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/students/:id/class", authenticateToken, requireAdmin, async (req, res) => {
    const beforeStudent = await Student.findOne({ id: toNumber(req.params.id) }).lean();
    const student = await Student.findOneAndUpdate(
      { id: toNumber(req.params.id) },
      { class_id: toNumber(req.body.class_id) },
      { returnDocument: "after" },
    ).lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }
    await writeAuditLog(req, {
      action: "update_student_class",
      entity: "student",
      entity_id: student.id,
      summary: `Changed class for ${student.reg_no}`,
      before: beforeStudent,
      after: student,
    });

    res.json({ success: true });
  });

  app.put("/api/admin/students/:id/reg-no", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const beforeStudent = await Student.findOne({ id: toNumber(req.params.id) }).lean();
      const student = await Student.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        { reg_no: req.body.reg_no },
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      await writeAuditLog(req, {
        action: "update_student_reg_no",
        entity: "student",
        entity_id: student.id,
        summary: `Changed reg no from ${beforeStudent?.reg_no || ""} to ${student.reg_no}`,
        before: beforeStudent,
        after: student,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/students/:id/fee-setup", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const beforeStudent = await Student.findOne({ id: toNumber(req.params.id) }).lean();
      const student = await Student.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        {
          coaching_fee: toNumber(req.body.coaching_fee),
          admission_fee: toNumber(req.body.admission_fee),
          transport: req.body.transport === "Yes" ? "Yes" : "No",
          transport_fee: toNumber(req.body.transport_fee),
          entrance: req.body.entrance === "Yes" ? "Yes" : "No",
          entrance_fee: toNumber(req.body.entrance_fee),
          fooding: req.body.fooding === "Yes" ? "Yes" : "No",
          fooding_fee: toNumber(req.body.fooding_fee),
        },
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }
      await writeAuditLog(req, {
        action: "update_student_fee_setup",
        entity: "student",
        entity_id: student.id,
        summary: `Updated fee setup for ${student.reg_no}`,
        before: beforeStudent,
        after: student,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // --- FeeStructure APIs ---

  app.get("/api/admin/fee-structures", authenticateToken, requireAdmin, async (_req, res) => {
    const records = await FeeStructure.find().sort({ id: 1 }).lean();
    res.json(records.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/fee-structures", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const classId = toNumber(req.body.class_id);
      const classDoc = await ClassModel.findOne({ id: classId }).lean();
      if (!classDoc) {
        return res.status(404).json({ error: "Class not found" });
      }

      const derivedStream = getCollegeStreamLabel(classDoc.name);
      const stream = derivedStream !== "None" ? derivedStream : String(req.body.stream || "None");
      const id = await getNextSequence("feeStructures");
      const record = await FeeStructure.create({
        id,
        academic_session: req.body.academic_session,
        class_id: classId,
        stream,
        fee_type: req.body.fee_type,
        amount: toNumber(req.body.amount),
      });
      await writeAuditLog(req, {
        action: "create_fee_structure",
        entity: "fee_structure",
        entity_id: record.id,
        summary: `Created ${record.fee_type} structure for ${classDoc.name}`,
        after: record.toObject(),
      });

      res.json(stripMongoFields(record.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/fee-structures/:id", authenticateToken, requireAdmin, async (req, res) => {
    const deleted = await FeeStructure.findOneAndDelete({ id: toNumber(req.params.id) }).lean();
    if (!deleted) {
      return res.status(404).json({ error: "Fee Structure not found" });
    }
    await writeAuditLog(req, {
      action: "delete_fee_structure",
      entity: "fee_structure",
      entity_id: deleted.id,
      summary: `Deleted ${deleted.fee_type} fee structure`,
      before: deleted,
    });
    res.json({ success: true });
  });

  async function createPendingFeesFromStructure({
    studentIds,
    academicSession,
    classId,
    stream,
  }: {
    studentIds: number[];
    academicSession: string;
    classId: number;
    stream: string;
  }) {
    const structures = await FeeStructure.find({
      academic_session: academicSession,
      class_id: classId,
      stream,
    }).lean();

    if (structures.length === 0) {
      return { createdCount: 0, structureCount: 0 };
    }

    const students = await Student.find({
      id: { $in: studentIds },
      status: "active",
    }).lean();

    let createdCount = 0;
    const today = dateString();

    for (const student of students) {
      for (const structure of structures) {
        const existing = await Fee.findOne({
          student_id: student.id,
          academic_session: academicSession,
          class_id: classId,
          type: structure.fee_type,
        }).lean();

        if (existing) {
          continue;
        }

        const feeId = await getNextSequence("fees");
        await Fee.create({
          id: feeId,
          student_id: student.id,
          academic_session: academicSession,
          class_id: classId,
          amount: structure.amount,
          type: structure.fee_type,
          date: today,
          status: "pending",
          discount: 0,
          mode: "System",
          reference_no: "Auto-created after promotion",
          bill_no: formatAppBillNo(feeId),
        });
        createdCount++;
      }
    }

    return { createdCount, structureCount: structures.length };
  }

  app.post("/api/admin/fees/apply-structure", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { academic_session } = req.body;
      const classId = toNumber(req.body.class_id);
      const classDoc = await ClassModel.findOne({ id: classId }).lean();
      if (!classDoc) {
        return res.status(404).json({ error: "Class not found" });
      }

      const stream = getCollegeStreamLabel(classDoc.name) !== "None" ? getCollegeStreamLabel(classDoc.name) : String(req.body.stream || "None");
      const structures = await FeeStructure.find({
        academic_session,
        class_id: classId,
        stream,
      }).lean();

      if (structures.length === 0) {
        return res.status(404).json({ error: "No fee structures configured for this selection" });
      }

      const students = await Student.find({
        status: "active",
        class_id: classId,
        stream,
      }).lean();

      let createdCount = 0;
      for (const student of students) {
        for (const struct of structures) {
          // Check if pending fee already exists to prevent duplicate applying
          const existing = await Fee.findOne({
            student_id: student.id,
            academic_session,
            class_id: struct.class_id,
            type: struct.fee_type,
          }).lean();

          if (!existing) {
            const feeId = await getNextSequence("fees");
            await Fee.create({
              id: feeId,
              student_id: student.id,
              academic_session,
              class_id: struct.class_id,
              amount: struct.amount,
              type: struct.fee_type,
              date: dateString(),
              status: "pending",
              bill_no: formatAppBillNo(feeId),
            });
            createdCount++;
          }
        }
      }

      await writeAuditLog(req, {
        action: "apply_fee_structure",
        entity: "fee",
        summary: `Applied fee structure and created ${createdCount} pending rows`,
        after: { academic_session, class_id: classId, stream, created_count: createdCount },
      });
      res.json({ success: true, count: createdCount });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // --- Promotion & Alumni ---

  app.post("/api/admin/students/promote/preview", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const studentIds = Array.isArray(req.body.student_ids)
        ? req.body.student_ids.map((id: unknown) => toNumber(id)).filter((id: number) => id > 0)
        : [];
      const targetClassId = toNumber(req.body.target_class_id);
      const targetSession = String(req.body.target_session || "");

      if (studentIds.length === 0 || !targetClassId || !targetSession) {
        return res.status(400).json({ error: "Students, target class, and target session are required." });
      }

      const [students, classes] = await Promise.all([
        Student.find({ id: { $in: studentIds } }).lean(),
        ClassModel.find().lean(),
      ]);
      const classNameById = new Map(classes.map((item) => [Number(item.id), String(item.name || "")]));
      const targetClassName = classNameById.get(targetClassId) || "";
      const targetStream = getCollegeStreamLabel(targetClassName);
      const structures = await FeeStructure.find({
        academic_session: targetSession,
        class_id: targetClassId,
        stream: targetStream,
      }).lean();
      const fees = await Fee.find({ student_id: { $in: studentIds }, status: "pending" }).lean();

      const rows = students.map((student) => {
        const currentClassName = classNameById.get(Number(student.class_id)) || "";
        const oldPending = fees
          .filter((fee) =>
            Number(fee.student_id) === Number(student.id) &&
            isOlderAcademicBucket(
              fee.academic_session,
              classNameById.get(Number(fee.class_id)) || "",
              targetSession,
              targetClassName,
            ),
          )
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        const alreadyCreated = fees
          .filter((fee) =>
            Number(fee.student_id) === Number(student.id) &&
            String(fee.academic_session || "") === targetSession &&
            Number(fee.class_id) === targetClassId,
          )
          .reduce((sum, fee) => sum + Number(fee.amount || 0), 0);
        return {
          student_id: student.id,
          name: student.name,
          reg_no: student.reg_no,
          current_class: currentClassName,
          target_class: targetClassName,
          old_pending_amount: oldPending,
          new_fee_amount: structures.reduce((sum, rule) => sum + Number(rule.amount || 0), 0),
          already_created_amount: alreadyCreated,
        };
      });

      res.json({
        target_class: targetClassName,
        target_session: targetSession,
        stream: targetStream,
        structure_count: structures.length,
        fee_rules: structures.map((rule) => ({ fee_type: rule.fee_type, amount: rule.amount })),
        students: rows,
        totals: {
          students: rows.length,
          old_pending_amount: rows.reduce((sum, row) => sum + row.old_pending_amount, 0),
          new_fee_amount: rows.reduce((sum, row) => sum + row.new_fee_amount, 0),
          already_created_amount: rows.reduce((sum, row) => sum + row.already_created_amount, 0),
        },
        warning: structures.length === 0 ? "No fee structure is configured for this target year/session." : "",
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/students/promote", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { student_ids, target_class_id, target_session, is_graduation } = req.body;
      if (!Array.isArray(student_ids) || student_ids.length === 0) {
        return res.status(400).json({ error: "No students provided" });
      }
      const studentIds = student_ids.map((id) => toNumber(id)).filter((id) => id > 0);

      const students = await Student.find({ id: { $in: studentIds } }).lean();
      if (students.length !== studentIds.length) {
        return res.status(404).json({ error: "One or more students could not be found" });
      }

      const classes = await ClassModel.find().lean();
      const classNameById = new Map(classes.map((item) => [item.id, item.name]));

      if (is_graduation) {
        const invalidGraduates = students.filter((student) => getCollegeYearRank(classNameById.get(student.class_id) || "") !== 2);
        if (invalidGraduates.length > 0) {
          return res.status(400).json({ error: "Only 2nd year students can be graduated to alumni." });
        }

        await Student.updateMany(
          { id: { $in: studentIds } },
          { $set: { status: "alumni" } }
        );
        await writeAuditLog(req, {
          action: "graduate_students",
          entity: "student",
          summary: `Graduated ${studentIds.length} students to alumni`,
          before: students,
          after: { student_ids: studentIds, status: "alumni" },
        });
      } else {
        const targetClassId = toNumber(target_class_id);
        const targetClassName = classNameById.get(toNumber(target_class_id)) || "";
        if (!targetClassName) {
          return res.status(400).json({ error: "Target class is required." });
        }

        for (const student of students) {
          const currentClassName = classNameById.get(student.class_id) || "";
          const expectedTarget = getPromotableTargetClassName(currentClassName);
          if (!expectedTarget) {
            return res.status(400).json({ error: `Students in ${currentClassName || "this class"} cannot be promoted automatically.` });
          }
          if (normalizeAcademicClassName(targetClassName) !== normalizeAcademicClassName(expectedTarget)) {
            return res.status(400).json({ error: `Promotion from ${currentClassName} is only allowed to ${expectedTarget}.` });
          }
        }

        const targetStream = getCollegeStreamLabel(targetClassName);
        const targetGroup = targetStream;
        await Student.updateMany(
          { id: { $in: studentIds } },
          {
            $set: {
              class_id: targetClassId,
              session: target_session,
              stream: targetStream,
              student_group: targetGroup,
            },
          }
        );

        const feeApplyResult = await createPendingFeesFromStructure({
          studentIds,
          academicSession: String(target_session || ""),
          classId: targetClassId,
          stream: targetStream,
        });
        await writeAuditLog(req, {
          action: "promote_students",
          entity: "student",
          summary: `Promoted ${studentIds.length} students to ${targetClassName}`,
          before: students,
          after: {
            student_ids: studentIds,
            target_class_id: targetClassId,
            target_class: targetClassName,
            target_session,
            created_fee_count: feeApplyResult.createdCount,
          },
        });

        return res.json({
          success: true,
          promoted_count: studentIds.length,
          created_fee_count: feeApplyResult.createdCount,
          fee_structure_count: feeApplyResult.structureCount,
          warning: feeApplyResult.structureCount === 0
            ? "Promotion completed, but no 2nd-year fee structure is configured for this batch/year."
            : "",
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/alumni", authenticateToken, requireAdmin, async (req, res) => {
    const alumni = await Student.find({ status: "alumni" }).sort({ id: -1 }).lean();
    res.json(alumni.map((item) => stripMongoFields(item)));
  });

  app.get("/api/fee-ledgers", authenticateToken, async (req, res) => {
    const ledgers = await FeeLedger.find({ active: true }).sort({ name: 1 }).lean();
    res.json(ledgers.map((item) => stripMongoFields(item)));
  });

  app.get("/api/admin/fee-structures", authenticateToken, requireAdmin, async (req, res) => {
    const structures = await FeeStructure.find().sort({ id: 1 }).lean();
    res.json(structures.map((item) => stripMongoFields(item)));
  });

  app.post("/api/admin/fee-structures", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = await getNextSequence("fee_structures");
      const structure = await FeeStructure.create({
        ...req.body,
        id,
      });
      res.json(stripMongoFields(structure.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/fee-structures/:id", authenticateToken, requireAdmin, async (req, res) => {
    const structure = await FeeStructure.findOneAndDelete({ id: toNumber(req.params.id) }).lean();
    if (!structure) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  });

  app.post("/api/admin/fees/apply-structure", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { academic_session, class_id, stream } = req.body;
      const numClassId = toNumber(class_id);

      const rules = await FeeStructure.find({ academic_session, class_id: numClassId, stream }).lean();
      if (rules.length === 0) {
        return res.status(400).json({ error: "No fee structures defined for this batch/group." });
      }

      const students = await Student.find({
        status: "active",
        session: academic_session,
        class_id: numClassId,
        $or: [{ stream: stream }, { stream: { $exists: false } }, { stream: "" }]
      }).lean();

      if (students.length === 0) {
        return res.status(400).json({ error: "No active students found in this batch/group." });
      }

      let count = 0;
      const date = dateString();
      for (const student of students) {
        for (const rule of rules) {
           const existing = await Fee.findOne({
             student_id: student.id,
             academic_session,
             class_id: numClassId,
             type: rule.fee_type
           }).lean();
           
           if (!existing) {
             const feeId = await getNextSequence("fees");
             await Fee.create({
               id: feeId,
               student_id: student.id,
               academic_session,
               class_id: numClassId,
               amount: rule.amount,
               type: rule.fee_type,
               date,
               status: "pending",
               bill_no: formatAppBillNo(feeId),
             });
             count++;
           }
        }
      }
      await writeAuditLog(req, {
        action: "apply_fee_structure",
        entity: "fee",
        summary: `Applied fee structure and created ${count} pending rows`,
        after: { academic_session, class_id: numClassId, stream, created_count: count },
      });
      res.json({ success: true, count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/admin/students/:id", authenticateToken, requireAdmin, async (req, res) => {
    const studentId = toNumber(req.params.id);
    const student = await Student.findOneAndDelete({ id: studentId }).lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    await Promise.all([
      Fee.deleteMany({ student_id: studentId }),
      Transaction.deleteMany({ student_id: studentId }),
      Attendance.deleteMany({ student_id: studentId }),
      Mark.deleteMany({ student_id: studentId }),
      FoodWallet.deleteMany({ student_id: studentId }),
      FoodTransaction.deleteMany({ student_id: studentId }),
      HostelAllotment.deleteMany({ student_id: studentId }),
    ]);
    await writeAuditLog(req, {
      action: "delete_student",
      entity: "student",
      entity_id: student.id,
      summary: `Deleted student ${student.reg_no}`,
      before: student,
    });

    res.json({ success: true });
  });

  app.post("/api/admin/fees/:id/cancel", authenticateToken, requireAdmin, async (req, res) => {
    const beforeFee = await Fee.findOne({ id: toNumber(req.params.id) }).lean();
    const fee = await Fee.findOneAndUpdate(
      { id: toNumber(req.params.id) },
      { status: "cancelled" },
      { returnDocument: "after" },
    ).lean();

    if (!fee) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const transactionId = await getNextSequence("transactions");
    await Transaction.create({
      id: transactionId,
      student_id: fee.student_id,
      amount: fee.amount,
      type: "debit",
      category: "fee-cancel",
      date: dateString(),
      description: `Payment cancelled: ${fee.type}`,
    });
    await writeAuditLog(req, {
      action: "cancel_fee",
      entity: "fee",
      entity_id: fee.id,
      summary: `Cancelled ${fee.bill_no}`,
      before: beforeFee,
      after: fee,
    });

    res.json({ success: true });
  });

  app.get("/api/admin/student-account", authenticateToken, requireAdmin, async (req, res) => {
    const query = String(req.query.query || "").trim();
    if (!query) {
      return res.json({ students: [] });
    }

    const numericQuery = toNumber(query);
    const isNumericQuery = query !== "" && String(numericQuery) === query;

    const students = await Student.find({
      $or: [
        ...(isNumericQuery ? [{ id: numericQuery }] : []),
        { name: { $regex: query, $options: "i" } },
        { reg_no: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ id: 1 })
      .limit(10)
      .lean();

    const studentIds = students.map((student) => student.id);
    const [classes, fees, transactions, feeStructures] = await Promise.all([
      ClassModel.find().lean(),
      Fee.find({ student_id: { $in: studentIds } }).sort({ id: -1 }).lean(),
      Transaction.find({ student_id: { $in: studentIds } }).sort({ id: -1 }).lean(),
      FeeStructure.find().lean(),
    ]);
    const classMap = new Map(classes.map((item) => [item.id, item.name]));

    res.json({
      students: students.map((student) => ({
        ...stripMongoFields(student),
        class_name: classMap.get(student.class_id) || "",
        dynamic_fees: computeDynamicFees(student, feeStructures),
        coaching_fee: student.coaching_fee || 0,
        admission_fee: student.admission_fee || 0,
        transport: student.transport || "No",
        transport_fee: student.transport_fee || 0,
        entrance: student.entrance || "No",
        entrance_fee: student.entrance_fee || 0,
        fooding: student.fooding || "No",
        fooding_fee: student.fooding_fee || 0,
        fees: fees.filter((fee) => fee.student_id === student.id).map((fee) => stripMongoFields(fee)),
        transactions: transactions
          .filter((transaction) => transaction.student_id === student.id)
          .map((transaction) => stripMongoFields(transaction)),
      })),
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }

      res.sendFile(DIST_INDEX);
    });
  }

  await connectToDatabase();
  console.log("Connected to MongoDB successfully");

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
