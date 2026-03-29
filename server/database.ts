import bcrypt from "bcryptjs";
import mongoose from "mongoose";
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
} from "./models.ts";

const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017/svm-classes-erp";

const defaultClasses = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
const defaultSubjects = ["English", "Mathematics", "Science", "Social Studies"];
const defaultFeeLedgers = [
  { name: "Admission Fee", description: "One-time admission charges" },
  { name: "Monthly Tuition", description: "Recurring monthly tuition fee" },
  { name: "Exam Fee", description: "Assessment and examination charges" },
];

const demoStudentDefaults = {
  father_phone: "",
  mother_phone: "",
  post: "",
  pin_code: "",
  thana: "",
  country: "India",
  state: "Odisha",
  district: "Ganjam",
  landmark: "",
  email: "",
  age: "",
  section: "A",
  session: "2025-2026",
  occupation: "Private Employee",
  roll_no: "",
  rfid_card_no: "",
  hostel_required: "No",
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
  coaching_fee: 30000,
  admission_fee: 10000,
  transport: "No",
  transport_fee: 0,
  entrance: "No",
  entrance_fee: 0,
  fooding: "No",
  fooding_fee: 0,
};

const demoStudents = [
  {
    ...demoStudentDefaults,
    name: "Aarav Sahu",
    father_name: "Ramesh Sahu",
    mother_name: "Sunita Sahu",
    phone: "9876543210",
    father_phone: "9437123401",
    mother_phone: "9437123402",
    address: "Digapahandi, Ganjam",
    post: "Digapahandi",
    pin_code: "761012",
    thana: "Digapahandi",
    landmark: "Near Bus Stand",
    email: "aarav.sahu@example.com",
    dob: "2012-05-12",
    age: "13",
    gender: "Male",
    className: "Class 1",
    category: "General",
    student_group: "Day Scholar",
    occupation: "Business",
    admission_date: "2026-01-10",
    reg_no: "SVM-1001",
    roll_no: "01",
    guardian1_relation: "Uncle",
    guardian1_mobile: "9123456701",
    guardian1_name: "Kiran Sahu",
    guardian1_address: "Digapahandi, Ganjam",
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Saanvi Patra",
    father_name: "Pradip Patra",
    mother_name: "Madhabi Patra",
    phone: "9861234567",
    father_phone: "9438201101",
    mother_phone: "9438201102",
    address: "Aska Road, Berhampur",
    post: "Berhampur",
    pin_code: "760001",
    thana: "Berhampur Town",
    landmark: "Aska Road",
    email: "saanvi.patra@example.com",
    dob: "2011-11-02",
    age: "14",
    gender: "Female",
    className: "Class 2",
    category: "OBC",
    student_group: "Science",
    occupation: "Govt Employee",
    admission_date: "2026-01-12",
    reg_no: "SVM-1002",
    hostel_required: "Yes",
    roll_no: "07",
    fooding: "Yes",
    fooding_fee: 2500,
    guardian1_relation: "Aunt",
    guardian1_mobile: "9123456702",
    guardian1_name: "Ritu Patra",
    guardian1_address: "Berhampur, Ganjam",
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Ritwik Panda",
    father_name: "Sanjay Panda",
    mother_name: "Anita Panda",
    phone: "9853011122",
    father_phone: "9437012201",
    mother_phone: "9437012202",
    address: "Medical Square, Berhampur",
    post: "Berhampur",
    pin_code: "760004",
    thana: "Baidyanathpur",
    landmark: "Medical Square",
    email: "ritwik.panda@example.com",
    dob: "2010-08-19",
    age: "15",
    gender: "Male",
    className: "Class 3",
    category: "General",
    student_group: "Commerce",
    occupation: "Teacher",
    admission_date: "2026-01-18",
    reg_no: "SVM-1003",
    roll_no: "11",
    transport: "Yes",
    transport_fee: 1800,
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Ishita Behera",
    father_name: "Suresh Behera",
    mother_name: "Lopamudra Behera",
    phone: "9937123456",
    father_phone: "9439001101",
    mother_phone: "9439001102",
    address: "MKCG Colony, Ganjam",
    post: "Berhampur",
    pin_code: "760004",
    thana: "Baidyanathpur",
    landmark: "MKCG Colony",
    email: "ishita.behera@example.com",
    dob: "2011-03-27",
    age: "14",
    gender: "Female",
    className: "Class 4",
    category: "SC",
    student_group: "Arts",
    occupation: "Farmer",
    admission_date: "2026-02-01",
    reg_no: "SVM-1004",
    hostel_required: "Yes",
    roll_no: "05",
    fooding: "Yes",
    fooding_fee: 2500,
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Devansh Nayak",
    father_name: "Amit Nayak",
    mother_name: "Pooja Nayak",
    phone: "9777777788",
    father_phone: "9437334401",
    mother_phone: "9437334402",
    address: "Digapahandi Main Road",
    post: "Digapahandi",
    pin_code: "761012",
    thana: "Digapahandi",
    landmark: "Main Road",
    email: "devansh.nayak@example.com",
    dob: "2010-12-14",
    age: "15",
    gender: "Male",
    className: "Class 5",
    category: "General",
    student_group: "Day Scholar",
    occupation: "Self Employed",
    admission_date: "2026-02-05",
    reg_no: "SVM-1005",
    roll_no: "18",
    entrance: "Yes",
    entrance_fee: 1200,
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Prisha Mishra",
    father_name: "Lokanath Mishra",
    mother_name: "Deepa Mishra",
    phone: "9861402201",
    father_phone: "9438123401",
    mother_phone: "9438123402",
    address: "Courtpeta, Berhampur",
    post: "Berhampur",
    pin_code: "760004",
    thana: "Berhampur Town",
    landmark: "Courtpeta",
    email: "prisha.mishra@example.com",
    dob: "2012-09-08",
    age: "13",
    gender: "Female",
    className: "Class 2",
    category: "General",
    student_group: "Science",
    occupation: "Doctor",
    admission_date: "2026-03-08",
    reg_no: "SVM-1006",
    roll_no: "12",
    transport: "Yes",
    transport_fee: 1800,
    status: "active",
  },
  {
    ...demoStudentDefaults,
    name: "Vihaan Pradhan",
    father_name: "Manoj Pradhan",
    mother_name: "Sasmita Pradhan",
    phone: "9856681122",
    father_phone: "9437556601",
    mother_phone: "9437556602",
    address: "Digapahandi Bypass",
    post: "Digapahandi",
    pin_code: "761012",
    thana: "Digapahandi",
    landmark: "Bypass Road",
    email: "vihaan.pradhan@example.com",
    dob: "2011-07-22",
    age: "14",
    gender: "Male",
    className: "Class 4",
    category: "ST",
    student_group: "Arts",
    occupation: "Govt Employee",
    admission_date: "2026-03-11",
    reg_no: "SVM-1007",
    hostel_required: "Yes",
    roll_no: "09",
    fooding: "Yes",
    fooding_fee: 2500,
    guardian1_relation: "Uncle",
    guardian1_mobile: "9123456707",
    guardian1_name: "Bikash Pradhan",
    guardian1_address: "Digapahandi, Ganjam",
    status: "active",
  },
];

async function ensureDocument(model: any, query: Record<string, unknown>, data: Record<string, unknown>, counterName: string) {
  const existing = await model.findOne(query).lean();
  if (existing) {
    return existing;
  }

  const id = await getNextSequence(counterName);
  const created = await model.create({ id, ...data });
  return created.toObject();
}

async function ensureSeedRecord(model: any, query: Record<string, unknown>, data: Record<string, unknown>, counterName: string) {
  const existing = await model.findOne(query).lean();
  if (existing) {
    return existing;
  }

  const id = await getNextSequence(counterName);
  const created = await model.create({ id, ...data });
  return created.toObject();
}

export async function connectToDatabase() {
  const mongodbUri = (process.env.MONGODB_URI || DEFAULT_MONGODB_URI).trim();

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongodbUri);
  await seedDatabase();
  return mongoose.connection;
}

async function seedDatabase() {
  const existingAdmin = await User.findOne({ username: "admin" }).lean();
  if (!existingAdmin) {
    const password = await bcrypt.hash("admin123", 10);
    const id = await getNextSequence("users");
    await User.create({
      id,
      username: "admin",
      password,
      role: "admin",
      name: "System Administrator",
    });
  }

  const classCount = await ClassModel.countDocuments();
  const subjectCount = await Subject.countDocuments();

  if (classCount === 0 && subjectCount === 0) {
    for (const className of defaultClasses) {
      const classDoc = await ensureDocument(
        ClassModel,
        { name: className },
        { name: className, batch_names: [] },
        "classes",
      );

      for (const subjectName of defaultSubjects) {
        await ensureDocument(
          Subject,
          { name: subjectName, class_id: classDoc.id },
          { name: subjectName, class_id: classDoc.id },
          "subjects",
        );
      }
    }
  }

  const classes: any[] = await ClassModel.find().lean();
  const classByName = new Map(classes.map((item) => [item.name, item.id]));

  for (const ledger of defaultFeeLedgers) {
    await ensureDocument(
      FeeLedger,
      { name: ledger.name },
      { ...ledger, active: true },
      "feeLedgers",
    );
  }

  // STOP SEEDING DEMO DATA HERE
  return;

  for (const student of demoStudents) {
    const class_id = classByName.get(student.className);
    const existingStudent = await Student.findOne({ reg_no: student.reg_no }).lean();

    if (existingStudent) {
      await Student.updateOne(
        { reg_no: student.reg_no },
        {
          $set: {
            ...student,
            class_id,
            photo_url: existingStudent.photo_url || "",
          },
        },
      );
      continue;
    }

    await ensureSeedRecord(
      Student,
      { reg_no: student.reg_no },
      {
        ...student,
        class_id,
        photo_url: "",
      },
      "students",
    );
  }

  const students: any[] = await Student.find().sort({ id: 1 }).lean();
  const studentByRegNo = new Map(students.map((item) => [item.reg_no, item]));

  const feeRows = [
    { reg_no: "SVM-1001", amount: 15000, type: "Admission Fee", date: "2026-01-10", status: "paid", bill_no: "BILL-1001" },
    { reg_no: "SVM-1001", amount: 3500, type: "Monthly Tuition", date: "2026-03-01", status: "paid", bill_no: "BILL-1002" },
    { reg_no: "SVM-1002", amount: 15000, type: "Admission Fee", date: "2026-01-12", status: "paid", bill_no: "BILL-1003" },
    { reg_no: "SVM-1002", amount: 4500, type: "Hostel Fee", date: "2026-03-02", status: "pending", bill_no: "BILL-1004" },
    { reg_no: "SVM-1003", amount: 3200, type: "Monthly Tuition", date: "2026-03-03", status: "paid", bill_no: "BILL-1005" },
    { reg_no: "SVM-1004", amount: 4500, type: "Hostel Fee", date: "2026-03-04", status: "paid", bill_no: "BILL-1006" },
    { reg_no: "SVM-1005", amount: 3500, type: "Monthly Tuition", date: "2026-03-05", status: "pending", bill_no: "BILL-1007" },
    { reg_no: "SVM-1006", amount: 3500, type: "Monthly Tuition", date: "2026-03-10", status: "paid", bill_no: "BILL-1008" },
    { reg_no: "SVM-1007", amount: 4500, type: "Hostel Fee", date: "2026-03-12", status: "paid", bill_no: "BILL-1009" },
    { reg_no: "SVM-1007", amount: 2000, type: "Exam Fee", date: "2026-03-13", status: "paid", bill_no: "BILL-1010" },
  ];

  for (const feeRow of feeRows) {
    const student = studentByRegNo.get(feeRow.reg_no);
    if (!student) continue;

    await ensureSeedRecord(
      Fee,
      { bill_no: feeRow.bill_no },
      {
        student_id: student.id,
        amount: feeRow.amount,
        type: feeRow.type,
        date: feeRow.date,
        status: feeRow.status,
        bill_no: feeRow.bill_no,
      },
      "fees",
    );

    await ensureSeedRecord(
      Transaction,
      { student_id: student.id, description: `${feeRow.type} - ${feeRow.status}`, date: feeRow.date },
      {
        student_id: student.id,
        amount: feeRow.amount,
        type: feeRow.status === "paid" ? "credit" : "debit",
        category: "fee",
        date: feeRow.date,
        description: `${feeRow.type} - ${feeRow.status}`,
      },
      "transactions",
    );
  }

  const hostelCount = await Hostel.countDocuments();
  if (hostelCount === 0) {
    const boysHostelId = await getNextSequence("hostels");
    const girlsHostelId = await getNextSequence("hostels");
    await Hostel.create([
      { id: boysHostelId, name: "Boys Hostel", type: "Boys" },
      { id: girlsHostelId, name: "Girls Hostel", type: "Girls" },
    ]);

    const roomRows = [
      { hostel_id: boysHostelId, room_no: "B-101", capacity: 4 },
      { hostel_id: boysHostelId, room_no: "B-102", capacity: 4 },
      { hostel_id: girlsHostelId, room_no: "G-201", capacity: 4 },
    ];

    for (const room of roomRows) {
      const id = await getNextSequence("rooms");
      await Room.create({ id, ...room });
    }
  }

  const roomRows: any[] = await Room.find().sort({ id: 1 }).lean();
  const allotmentCount = await HostelAllotment.countDocuments();
  if (allotmentCount === 0 && roomRows.length >= 2) {
    const hostellers = ["SVM-1002", "SVM-1004"];
    for (let index = 0; index < hostellers.length; index += 1) {
      const student = studentByRegNo.get(hostellers[index]);
      const room = roomRows[index];
      if (!student || !room) continue;

      const id = await getNextSequence("hostelAllotments");
      await HostelAllotment.create({
        id,
        student_id: student.id,
        room_id: room.id,
        bed_no: `Bed-${index + 1}`,
        start_date: "2026-02-10",
        end_date: "",
      });
    }
  }

  const examCount = await Exam.countDocuments();
  if (examCount === 0) {
    const examRows = [
      { name: "Unit Test 1", date: "2026-02-15", class_id: classByName.get("Class 3") },
      { name: "Mid Term", date: "2026-03-10", class_id: classByName.get("Class 5") },
    ];

    for (const exam of examRows) {
      const id = await getNextSequence("exams");
      await Exam.create({ id, ...exam });
    }
  }

  const markCount = await Mark.countDocuments();
  if (markCount === 0) {
    const exams: any[] = await Exam.find().sort({ id: 1 }).lean();
    const subjects: any[] = await Subject.find().sort({ id: 1 }).lean();
    const ritwik = studentByRegNo.get("SVM-1003");
    const devansh = studentByRegNo.get("SVM-1005");

    if (ritwik && exams[0] && subjects[0]) {
      const id = await getNextSequence("marks");
      await Mark.create({
        id,
        student_id: ritwik.id,
        exam_id: exams[0].id,
        subject_id: subjects.find((item) => item.class_id === ritwik.class_id)?.id || subjects[0].id,
        marks_obtained: 82,
        max_marks: 100,
      });
    }

    if (devansh && exams[1] && subjects[0]) {
      const id = await getNextSequence("marks");
      await Mark.create({
        id,
        student_id: devansh.id,
        exam_id: exams[1].id,
        subject_id: subjects.find((item) => item.class_id === devansh.class_id)?.id || subjects[0].id,
        marks_obtained: 88,
        max_marks: 100,
      });
    }
  }

  const attendanceCount = await Attendance.countDocuments();
  if (attendanceCount === 0) {
    const attendanceRows = [
      { reg_no: "SVM-1001", date: "2026-03-10", status: "present" },
      { reg_no: "SVM-1002", date: "2026-03-10", status: "late" },
      { reg_no: "SVM-1003", date: "2026-03-10", status: "present" },
      { reg_no: "SVM-1004", date: "2026-03-10", status: "present" },
      { reg_no: "SVM-1005", date: "2026-03-10", status: "absent" },
    ];

    for (const row of attendanceRows) {
      const student = studentByRegNo.get(row.reg_no);
      if (!student) continue;
      const id = await getNextSequence("attendance");
      await Attendance.create({ id, student_id: student.id, date: row.date, status: row.status });
    }
  }

  const walletCount = await FoodWallet.countDocuments();
  if (walletCount === 0) {
    const walletRows = [
      { reg_no: "SVM-1001", balance: 750 },
      { reg_no: "SVM-1002", balance: 540 },
      { reg_no: "SVM-1004", balance: 980 },
    ];

    for (const row of walletRows) {
      const student = studentByRegNo.get(row.reg_no);
      if (!student) continue;

      const walletId = await getNextSequence("foodWallets");
      await FoodWallet.create({
        id: walletId,
        student_id: student.id,
        balance: row.balance,
      });

      const txId = await getNextSequence("foodTransactions");
      await FoodTransaction.create({
        id: txId,
        student_id: student.id,
        amount: row.balance,
        type: "topup",
        date: "2026-03-01",
      });
    }
  }
}
