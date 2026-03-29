import mongoose from "mongoose";
import fs from "fs";
import { getNextSequence, Student } from "@/server/models";


const MONGO_URI = "mongodb+srv://nishantdash1997_db_user:veEhnjWEUNKfhAaW@cluster0.vz0ilpj.mongodb.net/svm-erp";

async function connectDB() {
    await mongoose.connect(MONGO_URI);
    console.log("✅ DB Connected");
}

async function importStudents() {
    const data = JSON.parse(fs.readFileSync("./students.json"));

    let success = 0;
    let skipped = 0;

    for (let student of data) {
        try {
            // ✅ duplicate check (reg_no unique)
            const exists = await Student.findOne({ reg_no: student.reg_no });

            if (exists) {
                console.log(`⚠️ Skipped (duplicate): ${student.reg_no}`);
                skipped++;
                continue;
            }

            // ✅ generate id
            const id = await getNextSequence("student");

            const newStudent = new Student({
                id,
                ...student,
            });

            await newStudent.save();

            console.log(`✅ Inserted: ${student.name}`);
            success++;

        } catch (err) {
            console.error(`❌ Error: ${student.name}`, err.message);
        }
    }

    console.log("\n📊 SUMMARY:");
    console.log("Inserted:", success);
    console.log("Skipped:", skipped);
}

async function main() {
    await connectDB();
    await importStudents();
    mongoose.disconnect();
}

main();