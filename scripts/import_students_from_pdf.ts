import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import mongoose from "mongoose";

import { connectToDatabase } from "../server/database.ts";
import {
  Attendance,
  ClassModel,
  Counter,
  Fee,
  FoodTransaction,
  FoodWallet,
  HostelAllotment,
  Mark,
  MedicalRecord,
  Student,
  Transaction,
  getNextSequence,
} from "../server/models.ts";

try {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} catch {
  // Ignore dotenv load issues and rely on the existing environment.
}

type ParsedStudent = {
  serial: number;
  name: string;
  gender: string;
  class_name: string;
  student_code: string;
  dob: string;
  father_name: string;
  phone: string;
  mother_name: string;
  reg_date: string;
  district: string;
  reg_no: string;
};

function toIsoDate(date: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!match) return "";
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function ageFromDob(dob: string) {
  if (!dob) return "";

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return String(Math.max(age, 0));
}

async function ensureClass(className: string) {
  const existing = await ClassModel.findOne({ name: className }).lean();
  if (existing) {
    return existing;
  }

  const id = await getNextSequence("classes");
  return ClassModel.create({
    id,
    name: className,
    batch_names: [],
  });
}

async function backupExistingData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const [students, fees, transactions, attendance, marks, hostelAllotments, foodWallets, foodTransactions, medicalRecords] =
    await Promise.all([
      Student.find().lean(),
      Fee.find().lean(),
      Transaction.find().lean(),
      Attendance.find().lean(),
      Mark.find().lean(),
      HostelAllotment.find().lean(),
      FoodWallet.find().lean(),
      FoodTransaction.find().lean(),
      MedicalRecord.find().lean(),
    ]);

  const backupPath = path.join(backupDir, `student-import-backup-${timestamp}.json`);
  await fs.writeFile(
    backupPath,
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        counts: {
          students: students.length,
          fees: fees.length,
          transactions: transactions.length,
          attendance: attendance.length,
          marks: marks.length,
          hostelAllotments: hostelAllotments.length,
          foodWallets: foodWallets.length,
          foodTransactions: foodTransactions.length,
          medicalRecords: medicalRecords.length,
        },
        students,
        fees,
        transactions,
        attendance,
        marks,
        hostelAllotments,
        foodWallets,
        foodTransactions,
        medicalRecords,
      },
      null,
      2,
    ),
  );

  return backupPath;
}

async function main() {
  const pdfArg = process.argv[2];
  if (!pdfArg) {
    console.error("Usage: node --import tsx scripts/import_students_from_pdf.ts <pdf-path>");
    process.exit(1);
  }

  const pdfPath = path.resolve(process.cwd(), pdfArg);
  const parserPath = path.resolve(process.cwd(), "scripts/extract_students_from_pdf.py");

  const parsed = spawnSync("python3", [parserPath, pdfPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (parsed.status !== 0) {
    console.error(parsed.stderr || parsed.stdout || "Failed to parse PDF");
    process.exit(parsed.status ?? 1);
  }

  const students = JSON.parse(parsed.stdout) as ParsedStudent[];
  if (!Array.isArray(students) || students.length === 0) {
    console.error("No students were extracted from the PDF.");
    process.exit(1);
  }

  await connectToDatabase();

  const backupPath = await backupExistingData();
  const classDoc = await ensureClass(students[0].class_name || "XII SC");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Promise.all([
        Fee.deleteMany({}, { session }),
        Transaction.deleteMany({}, { session }),
        Attendance.deleteMany({}, { session }),
        Mark.deleteMany({}, { session }),
        HostelAllotment.deleteMany({}, { session }),
        FoodWallet.deleteMany({}, { session }),
        FoodTransaction.deleteMany({}, { session }),
        MedicalRecord.deleteMany({}, { session }),
        Student.deleteMany({}, { session }),
      ]);

      const payload = [];
      for (const parsedStudent of students) {
        const id = await getNextSequence("students");
        payload.push({
          id,
          name: parsedStudent.name,
          father_name: parsedStudent.father_name,
          mother_name: parsedStudent.mother_name,
          phone: parsedStudent.phone,
          address: parsedStudent.district ? `${parsedStudent.district}, Odisha` : "",
          country: "India",
          state: "Odisha",
          district: parsedStudent.district || "Ganjam",
          dob: parsedStudent.dob,
          age: ageFromDob(parsedStudent.dob),
          gender: parsedStudent.gender || "Male",
          class_id: classDoc.id,
          section: "",
          session: "2025-2026",
          category: "General",
          student_group: "Science",
          admission_date: toIsoDate(parsedStudent.reg_date),
          reg_no: parsedStudent.reg_no,
          roll_no: parsedStudent.student_code,
          hostel_required: "No",
          status: "active",
        });
      }

      await Student.insertMany(payload, { session });
    });
  } finally {
    await session.endSession();
  }

  const totalStudents = await Student.countDocuments();
  const firstFew = await Student.find().sort({ id: 1 }).limit(5).lean();

  console.log(
    JSON.stringify(
      {
        ok: true,
        imported_students: totalStudents,
        backup_path: backupPath,
        class_name: classDoc.name,
        sample: firstFew.map((student: any) => ({
          id: student.id,
          name: student.name,
          reg_no: student.reg_no,
          roll_no: student.roll_no,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
