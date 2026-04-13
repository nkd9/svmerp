import mongoose, { Schema } from "mongoose";

const schemaOptions = {
  versionKey: false as const,
};

const counterSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
  },
  schemaOptions,
);

const userSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    name: { type: String, required: true },
  },
  schemaOptions,
);

const classSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    batch_names: { type: [String], default: [] },
  },
  schemaOptions,
);

const studentSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    father_name: { type: String, default: "" },
    mother_name: { type: String, default: "" },
    phone: { type: String, default: "" },
    father_phone: { type: String, default: "" },
    mother_phone: { type: String, default: "" },
    address: { type: String, default: "" },
    post: { type: String, default: "" },
    pin_code: { type: String, default: "" },
    thana: { type: String, default: "" },
    country: { type: String, default: "" },
    state: { type: String, default: "" },
    district: { type: String, default: "" },
    landmark: { type: String, default: "" },
    email: { type: String, default: "" },
    dob: { type: String, default: "" },
    age: { type: String, default: "" },
    gender: { type: String, default: "Male" },
    class_id: { type: Number, required: true },
    section: { type: String, default: "" },
    session: { type: String, default: "" },
    category: { type: String, default: "General" },
    student_group: { type: String, default: "None" },
    stream: { type: String, default: "None" },
    occupation: { type: String, default: "" },
    admission_date: { type: String, required: true },
    reg_no: { type: String, required: true, unique: true, trim: true },
    photo_url: { type: String, default: "" },
    roll_no: { type: String, default: "" },
    rfid_card_no: { type: String, default: "" },
    hostel_required: { type: String, default: "No" },
    student_aadhaar_no: { type: String, default: "" },
    mother_aadhaar_no: { type: String, default: "" },
    father_aadhaar_no: { type: String, default: "" },
    bank_name: { type: String, default: "" },
    account_no: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    guardian1_relation: { type: String, default: "" },
    guardian1_mobile: { type: String, default: "" },
    guardian1_name: { type: String, default: "" },
    guardian1_address: { type: String, default: "" },
    guardian1_aadhaar_no: { type: String, default: "" },
    guardian2_relation: { type: String, default: "" },
    guardian2_mobile: { type: String, default: "" },
    guardian2_name: { type: String, default: "" },
    guardian2_address: { type: String, default: "" },
    guardian2_aadhaar_no: { type: String, default: "" },
    coaching_fee: { type: Number, default: 0 },
    admission_fee: { type: Number, default: 0 },
    transport: { type: String, default: "No" },
    transport_fee: { type: Number, default: 0 },
    entrance: { type: String, default: "No" },
    entrance_fee: { type: Number, default: 0 },
    fooding: { type: String, default: "No" },
    fooding_fee: { type: Number, default: 0 },
    status: { type: String, default: "active" },
  },
  schemaOptions,
);

const subjectSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    class_id: { type: Number, required: true },
  },
  schemaOptions,
);

const examSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    class_id: { type: Number, required: true },
    subject_max_marks: {
      type: [
        {
          subject_id: { type: Number, required: true },
          max_marks: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  schemaOptions,
);

const markSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    exam_id: { type: Number, required: true },
    subject_id: { type: Number, required: true },
    marks_obtained: { type: Number, required: true },
    max_marks: { type: Number, required: true },
  },
  schemaOptions,
);

const feeSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    academic_session: { type: String, default: "" },
    class_id: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, default: "paid" },
    discount: { type: Number, default: 0 },
    mode: { type: String, default: "Cash" },
    reference_no: { type: String, default: "" },
    bill_no: { type: String, required: true, unique: true, trim: true },
  },
  schemaOptions,
);

const feeStructureSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    academic_session: { type: String, required: true },
    class_id: { type: Number, required: true },
    stream: { type: String, required: true },
    fee_type: { type: String, required: true },
    amount: { type: Number, required: true },
  },
  schemaOptions,
);

const feeLedgerSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  schemaOptions,
);

const transactionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String, required: true },
  },
  schemaOptions,
);

const hostelSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
  },
  schemaOptions,
);

const roomSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    hostel_id: { type: Number, required: true },
    room_no: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true },
  },
  schemaOptions,
);

const hostelAllotmentSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    room_id: { type: Number, required: true },
    bed_no: { type: String, required: true, trim: true },
    start_date: { type: String, required: true },
    end_date: { type: String, default: "" },
  },
  schemaOptions,
);

const attendanceSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    date: { type: String, required: true },
    status: { type: String, required: true },
  },
  schemaOptions,
);

const medicalRecordSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    condition: { type: String, default: "" },
    treatment: { type: String, default: "" },
    date: { type: String, required: true },
    status: { type: String, default: "" },
  },
  schemaOptions,
);

const foodWalletSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true, unique: true, index: true },
    balance: { type: Number, default: 0 },
  },
  schemaOptions,
);

const foodTransactionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    student_id: { type: Number, required: true },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    date: { type: String, required: true },
  },
  schemaOptions,
);

const sessionSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
  },
  schemaOptions,
);

const streamSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
  },
  schemaOptions,
);

const auditLogSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true, index: true },
    user_id: { type: Number, default: 0 },
    username: { type: String, default: "" },
    role: { type: String, default: "" },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entity_id: { type: String, default: "" },
    summary: { type: String, default: "" },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    date: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  schemaOptions,
);

export const Counter: any = mongoose.models.Counter || mongoose.model("Counter", counterSchema);
export const User: any = mongoose.models.User || mongoose.model("User", userSchema);
export const ClassModel: any = mongoose.models.Class || mongoose.model("Class", classSchema);
export const Student: any = mongoose.models.Student || mongoose.model("Student", studentSchema);
export const Subject: any = mongoose.models.Subject || mongoose.model("Subject", subjectSchema);
export const Exam: any = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export const Mark: any = mongoose.models.Mark || mongoose.model("Mark", markSchema);
export const Fee: any = mongoose.models.Fee || mongoose.model("Fee", feeSchema);
export const FeeStructure: any = mongoose.models.FeeStructure || mongoose.model("FeeStructure", feeStructureSchema);
export const FeeLedger: any = mongoose.models.FeeLedger || mongoose.model("FeeLedger", feeLedgerSchema);
export const Transaction: any = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
export const Hostel: any = mongoose.models.Hostel || mongoose.model("Hostel", hostelSchema);
export const Room: any = mongoose.models.Room || mongoose.model("Room", roomSchema);
export const HostelAllotment: any =
  mongoose.models.HostelAllotment || mongoose.model("HostelAllotment", hostelAllotmentSchema);
export const Attendance: any = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
export const MedicalRecord: any =
  mongoose.models.MedicalRecord || mongoose.model("MedicalRecord", medicalRecordSchema);
export const FoodWallet: any = mongoose.models.FoodWallet || mongoose.model("FoodWallet", foodWalletSchema);
export const FoodTransaction: any =
  mongoose.models.FoodTransaction || mongoose.model("FoodTransaction", foodTransactionSchema);
export const AcademicSessionMaster: any =
  mongoose.models.AcademicSessionMaster || mongoose.model("AcademicSessionMaster", sessionSchema);
export const StreamMaster: any =
  mongoose.models.StreamMaster || mongoose.model("StreamMaster", streamSchema);
export const AuditLog: any = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export async function getNextSequence(name: string) {
  const counter: any = await Counter.findOneAndUpdate(
    { name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  );
  return counter.seq;
}
