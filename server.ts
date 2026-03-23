import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectToDatabase } from "./server/database.ts";
import {
  Attendance,
  ClassModel,
  Exam,
  Fee,
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
  getNextSequence,
} from "./server/models.ts";

try {
  dotenv.config({ path: ".env.local" });
  dotenv.config();
} catch (e) {
  console.log("Dotenv load skipped or failed - relying on system environment variables.");
}

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";
const PORT = Number(process.env.PORT || 3000);
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

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildStudentPayload(body: any, existingStatus?: string) {
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
    class_id: toNumber(body.class_id),
    section: body.section || "",
    session: body.session || "",
    category: body.category || "General",
    student_group: body.student_group || "None",
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
    const [students, classes] = await Promise.all([
      Student.find().sort({ id: 1 }).lean(),
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

  app.post("/api/students", authenticateToken, async (req, res) => {
    try {
      const id = await getNextSequence("students");
      const payload = {
        id,
        ...buildStudentPayload(req.body),
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
        buildStudentPayload(req.body, "active"),
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
      const feeId = await getNextSequence("fees");
      const payload = {
        id: feeId,
        student_id: toNumber(req.body.student_id),
        amount: toNumber(req.body.amount),
        type: req.body.type || "Fee Collection",
        date: req.body.date || dateString(),
        status: req.body.status || "paid",
        discount: toNumber(req.body.discount),
        mode: req.body.mode || "Cash",
        reference_no: req.body.reference_no || "",
        bill_no: req.body.bill_no,
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

      res.json({ id: fee.id });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/fees/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const feeId = toNumber(req.params.id);
      const updatedAmount = toNumber(req.body.amount);

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
      Fee.find({ status: "pending" }).lean(),
      Student.find().lean(),
      ClassModel.find().lean(),
    ]);
    const studentMap = new Map<number, any>(students.map((item) => [item.id, item]));
    const classMap = new Map<number, string>(classes.map((item) => [item.id, item.name]));
    const grouped = new Map<number, { name: string; reg_no: string; class_name: string; pending_amount: number }>();

    for (const fee of fees) {
      const student = studentMap.get(fee.student_id) as any;
      if (!student) {
        continue;
      }

      const current = grouped.get(student.id) || {
        name: student.name,
        reg_no: student.reg_no,
        class_name: classMap.get(student.class_id) || "",
        pending_amount: 0,
      };

      current.pending_amount += fee.amount;
      grouped.set(student.id, current);
    }

    res.json(Array.from(grouped.values()));
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

      res.json(stripMongoFields(classDoc.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
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

      res.json(stripMongoFields(ledger.toObject()));
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.put("/api/admin/students/:id/class", authenticateToken, requireAdmin, async (req, res) => {
    const student = await Student.findOneAndUpdate(
      { id: toNumber(req.params.id) },
      { class_id: toNumber(req.body.class_id) },
      { returnDocument: "after" },
    ).lean();

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.json({ success: true });
  });

  app.put("/api/admin/students/:id/reg-no", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const student = await Student.findOneAndUpdate(
        { id: toNumber(req.params.id) },
        { reg_no: req.body.reg_no },
        { returnDocument: "after", runValidators: true },
      ).lean();

      if (!student) {
        return res.status(404).json({ error: "Student not found" });
      }

      res.json({ success: true });
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

    res.json({ success: true });
  });

  app.post("/api/admin/fees/:id/cancel", authenticateToken, requireAdmin, async (req, res) => {
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

    res.json({ success: true });
  });

  app.get("/api/admin/student-account", authenticateToken, requireAdmin, async (req, res) => {
    const query = String(req.query.query || "").trim();
    if (!query) {
      return res.json({ students: [] });
    }

    const students = await Student.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { reg_no: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
      ],
    })
      .sort({ id: 1 })
      .limit(10)
      .lean();

    const studentIds = students.map((student) => student.id);
    const [classes, fees, transactions] = await Promise.all([
      ClassModel.find().lean(),
      Fee.find({ student_id: { $in: studentIds } }).sort({ id: -1 }).lean(),
      Transaction.find({ student_id: { $in: studentIds } }).sort({ id: -1 }).lean(),
    ]);
    const classMap = new Map(classes.map((item) => [item.id, item.name]));

    res.json({
      students: students.map((student) => ({
        ...stripMongoFields(student),
        class_name: classMap.get(student.class_id) || "",
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
