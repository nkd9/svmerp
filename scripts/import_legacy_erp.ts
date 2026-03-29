import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

import {
  AcademicSessionMaster,
  Attendance,
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
  Student,
  StreamMaster,
  Subject,
  Transaction,
  getNextSequence,
} from "../server/models.ts";
import { connectToDatabase } from "../server/database.ts";

try {
  dotenv.config({ path: ".env.local", override: true });
  dotenv.config();
} catch {
  // Ignore dotenv issues and use the existing environment.
}

type TextBlock = {
  page: number;
  x: number;
  y: number;
  text: string;
};

type LegacyStudentSeed = {
  name: string;
  father_name: string;
  mother_name: string;
  phone: string;
  dob: string;
  gender: string;
  class_name: string;
  session: string;
  stream: string;
  student_group: string;
  admission_date: string;
  reg_no: string;
  roll_no: string;
  address: string;
  district: string;
  hostel_required: string;
  status: "active" | "alumni";
  admission_fee: number;
  coaching_fee: number;
  transport: string;
  transport_fee: number;
  fooding: string;
  fooding_fee: number;
  photo_url?: string;
};

type FeeSeed = {
  reg_no: string;
  class_name: string;
  academic_session: string;
  amount: number;
  type: string;
  date: string;
  status: "pending";
  mode: string;
  bill_no: string;
  reference_no: string;
};

type DueRow = {
  reg_no: string;
  name: string;
  father_name?: string;
  phone?: string;
  class_name: string;
  stream: string;
  session: string;
  amount: number;
  type: string;
  reference_no?: string;
};

const DATA_DIR = "/Users/sagarika/Downloads";
const IMPORT_DATE = "2026-03-29";
const DEFAULT_COUNTRY = "India";
const DEFAULT_STATE = "Odisha";
const UTF16_BE_DECODER = new TextDecoder("utf-16be");
const COLLEGE_CLASS_SUBJECTS: Record<string, string[]> = {
  "XI ARTS": ["English", "Odia", "History", "Political Science", "Education"],
  "XII ARTS": ["English", "Odia", "History", "Political Science", "Education"],
  "XI SC": ["English", "Physics", "Chemistry", "Mathematics", "Biology"],
  "XII SC": ["English", "Physics", "Chemistry", "Mathematics", "Biology"],
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

function cleanCell(value: string) {
  return normalizeWhitespace(value.replace(/[_|]+/g, " ").replace(/\s*:\s*/g, ": ").replace(/\s+-/g, "-"));
}

function normalizeRegNo(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function titleCaseWords(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toIsoDate(value: string) {
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm}-${dd}`;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return value;
  }

  return "";
}

function ageFromDob(dob: string) {
  if (!dob) return "";

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "";

  const today = new Date(IMPORT_DATE);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return String(Math.max(age, 0));
}

function inferDistrict(address: string) {
  if (/kandhamal/i.test(address)) return "Kandhamal";
  if (/ganjam/i.test(address)) return "Ganjam";
  return "Ganjam";
}

function inferSessionFromRegNo(regNo: string) {
  const normalized = normalizeRegNo(regNo);
  if (/^[A-Z]*24/.test(normalized)) return "2024-2025";
  if (/^[A-Z]*25/.test(normalized) || /^[A-Z]*26/.test(normalized)) return "2025-2026";
  return "2025-2026";
}

function inferStreamFromClassName(className: string) {
  if (/arts/i.test(className)) return "Arts";
  if (/\bsc\b|science/i.test(className)) return "Science";
  return "None";
}

function mapOldDueType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("coatch") || normalized.includes("coach")) return "Coaching Fee";
  if (normalized.includes("food")) return "Food Fee";
  if (normalized.includes("hostel")) return "Hostel Fee";
  if (normalized.includes("transport")) return "Transport Fee";
  return titleCaseWords(value);
}

function uniqueLineStrings(blocks: TextBlock[]) {
  const lines = new Map<number, string[]>();

  for (const block of [...blocks].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const existingKey = [...lines.keys()].find((key) => Math.abs(key - block.y) <= 1.25);
    const key = existingKey ?? block.y;
    const bucket = lines.get(key) ?? [];
    if (!bucket.includes(block.text)) {
      bucket.push(block.text);
    }
    lines.set(key, bucket);
  }

  return [...lines.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, entries]) => ({ y, text: cleanCell(entries.join(" ")) }));
}

function isStudentMetaLine(value: string) {
  return /^(Class|Student Id|DOB)\b/i.test(value);
}

function isGenderOnlyLine(value: string) {
  return /^\(?\s*(Male|Female)\s*\)?$/i.test(value);
}

function extractStudentNameAndGender(infoLines: Array<{ y: number; text: string }>) {
  let gender = "Male";
  for (const line of infoLines) {
    const match = /\((Male|Female)\)/i.exec(line.text) || /^(Male|Female)$/i.exec(line.text);
    if (match) {
      gender = titleCaseWords(match[1]);
      break;
    }
  }

  for (let index = 0; index < infoLines.length; index += 1) {
    const line = infoLines[index];
    const cleaned = cleanCell(line.text.replace(/\((Male|Female)\)/gi, ""));
    if (cleaned && !isStudentMetaLine(cleaned) && !isGenderOnlyLine(cleaned)) {
      return { name: cleaned.toUpperCase(), gender };
    }

    if (isGenderOnlyLine(line.text) && index > 0) {
      const previous = cleanCell(infoLines[index - 1].text.replace(/\((Male|Female)\)/gi, ""));
      if (previous && !isStudentMetaLine(previous) && !isGenderOnlyLine(previous)) {
        return { name: previous.toUpperCase(), gender };
      }
    }
  }

  const fallback = infoLines
    .map((line) => cleanCell(line.text.replace(/\((Male|Female)\)/gi, "")))
    .find((value) => value && !isStudentMetaLine(value) && !isGenderOnlyLine(value));

  return { name: (fallback ?? "").toUpperCase(), gender };
}

function parsePdfObjects(pdfBytes: Buffer) {
  const objects = new Map<number, Buffer>();
  const pattern = /(\d+) 0 obj([\s\S]*?)endobj/g;
  const text = pdfBytes.toString("latin1");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    objects.set(Number(match[1]), Buffer.from(match[2], "latin1"));
  }

  return objects;
}

function decodeUtf16Be(hex: string) {
  return UTF16_BE_DECODER.decode(Buffer.from(hex, "hex"));
}

function getStream(objects: Map<number, Buffer>, objectId: number) {
  const body = objects.get(objectId);
  if (!body) return Buffer.alloc(0);

  const match = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(body.toString("latin1"));
  if (!match) return Buffer.alloc(0);

  let data = Buffer.from(match[1], "latin1");
  if (body.includes(Buffer.from("/FlateDecode"))) {
    data = Buffer.from(inflateSync(data));
  }
  return data;
}

function parseCmap(data: Buffer) {
  const text = data.toString("latin1");
  const cmap = new Map<string, string>();
  let codeWidth = 4;

  const codeSpace = /begincodespacerange([\s\S]*?)endcodespacerange/.exec(text);
  if (codeSpace) {
    const widths = [...codeSpace[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)].map((match) => match[1].length);
    if (widths.length > 0) {
      codeWidth = Math.max(...widths);
    }
  }

  for (const block of text.matchAll(/(\d+) beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const entry of block[2].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      cmap.set(entry[1].toUpperCase(), decodeUtf16Be(entry[2]));
    }
  }

  for (const block of text.matchAll(/(\d+) beginbfrange([\s\S]*?)endbfrange/g)) {
    const lines = block[2].trim().split(/\r?\n/);
    for (const line of lines) {
      const rangeMatch = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(line);
      if (rangeMatch) {
        const [startHex, endHex, targetHex] = rangeMatch.slice(1);
        const start = Number.parseInt(startHex, 16);
        const end = Number.parseInt(endHex, 16);
        const target = Number.parseInt(targetHex, 16);
        for (let code = start; code <= end; code += 1) {
          const mapped = decodeUtf16Be((target + (code - start)).toString(16).padStart(4, "0"));
          cmap.set(code.toString(16).toUpperCase().padStart(startHex.length, "0"), mapped);
        }
        continue;
      }

      const arrayMatch = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]/.exec(line);
      if (arrayMatch) {
        const start = Number.parseInt(arrayMatch[1], 16);
        const width = arrayMatch[1].length;
        let offset = 0;
        for (const item of arrayMatch[3].matchAll(/<([0-9A-Fa-f]+)>/g)) {
          cmap.set((start + offset).toString(16).toUpperCase().padStart(width, "0"), decodeUtf16Be(item[1]));
          offset += 1;
        }
      }
    }
  }

  return { cmap, codeWidth };
}

function decodeHexText(value: string, fontInfo: { cmap: Map<string, string>; codeWidth: number }) {
  const condensed = value.replace(/\s+/g, "").toUpperCase();
  let result = "";

  for (let index = 0; index < condensed.length; index += fontInfo.codeWidth) {
    const chunk = condensed.slice(index, index + fontInfo.codeWidth);
    result += fontInfo.cmap.get(chunk) ?? "";
  }

  return result;
}

async function extractPdfBlocks(pdfPath: string) {
  const pdfBytes = await fs.readFile(pdfPath);
  const objects = parsePdfObjects(pdfBytes);
  const fontMaps = new Map<number, { cmap: Map<string, string>; codeWidth: number }>();

  for (const [objectId, body] of objects.entries()) {
    const match = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(body.toString("latin1"));
    if (match) {
      fontMaps.set(objectId, parseCmap(getStream(objects, Number(match[1]))));
    }
  }

  const pageIds = [...objects.entries()]
    .filter(([, body]) => /\/Type\s*\/Page\b/.test(body.toString("latin1")))
    .map(([objectId]) => objectId)
    .sort((a, b) => a - b);

  const blocks: TextBlock[] = [];

  for (const [pageIndex, pageId] of pageIds.entries()) {
    const pageBody = objects.get(pageId)?.toString("latin1") ?? "";
    const contentsMatch = /\/Contents\s*(\[(?:.|\r|\n)*?\]|\d+\s+0\s+R)/.exec(pageBody);
    if (!contentsMatch) continue;

    const contentRefs = [...contentsMatch[1].matchAll(/(\d+)\s+0\s+R/g)].map((match) => Number(match[1]));
    const fonts = new Map<string, { cmap: Map<string, string>; codeWidth: number }>();
    const fontBlock = /\/Font\s*<<([\s\S]*?)>>/.exec(pageBody);
    if (fontBlock) {
      for (const match of fontBlock[1].matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
        fonts.set(match[1].slice(1), fontMaps.get(Number(match[2])) ?? { cmap: new Map(), codeWidth: 4 });
      }
    }

    for (const contentRef of contentRefs) {
      const content = getStream(objects, contentRef).toString("latin1");
      for (const textBlock of content.matchAll(/BT([\s\S]*?)ET/g)) {
        const fontMatch = /\/F(\d+)\s+\d+(?:\.\d+)?\s+Tf/.exec(textBlock[1]);
        const positionMatch = /1 0 0 -1 ([\d.]+) ([\d.]+) Tm/.exec(textBlock[1]);
        if (!fontMatch || !positionMatch) continue;

        let text = "";
        for (const arr of textBlock[1].matchAll(/\[(.*?)\]\s*TJ/gs)) {
          for (const hex of arr[1].matchAll(/<([^>]+)>/g)) {
            text += decodeHexText(hex[1], fonts.get(fontMatch[1]) ?? { cmap: new Map(), codeWidth: 4 });
          }
        }
        for (const direct of textBlock[1].matchAll(/<([^>]+)>\s*Tj/g)) {
          text += decodeHexText(direct[1], fonts.get(fontMatch[1]) ?? { cmap: new Map(), codeWidth: 4 });
        }

        text = cleanCell(text);
        if (!text) continue;

        blocks.push({
          page: pageIndex + 1,
          x: Number.parseFloat(positionMatch[1]),
          y: Number.parseFloat(positionMatch[2]),
          text,
        });
      }
    }
  }

  const deduped = new Map<string, TextBlock>();
  for (const block of blocks) {
    deduped.set(`${block.page}|${block.x}|${block.y}|${block.text}`, block);
  }

  return [...deduped.values()].sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}

async function parseActiveStudentPdf(pdfPath: string, fallbackClassName: string, stream: string) {
  const blocks = await extractPdfBlocks(pdfPath);
  const parsed = new Map<string, LegacyStudentSeed>();
  const pages = new Set(blocks.map((block) => block.page));

  for (const page of pages) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    const serials = pageBlocks
      .filter(
        (block) =>
          block.x >= 20 &&
          block.x <= 28 &&
          block.y >= 70 &&
          /^\d+$/.test(block.text) &&
          pageBlocks.some(
            (peer) =>
              peer.x >= 60 && peer.x <= 220 && Math.abs(peer.y - block.y) <= 2 && /[A-Za-z]/.test(peer.text) && !/Student Inforamtion/i.test(peer.text),
          ),
      )
      .sort((a, b) => a.y - b.y);

    for (let index = 0; index < serials.length; index += 1) {
      const start = serials[index];
      const next = serials[index + 1];
      const rowBlocks = pageBlocks.filter(
        (block) => block.y >= start.y && (!next || block.y < next.y) && block.x >= 60 && block.x < 760,
      );

      const infoLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 60 && block.x < 220));
      const parentLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 220 && block.x < 380)).map((line) => line.text);
      const addressLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 380 && block.x < 530)).map((line) => line.text);
      const regLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 530 && block.x < 760)).map((line) => line.text);

      const { name, gender } = extractStudentNameAndGender(infoLines);

      const classLine = infoLines.find((line) => /Class/i.test(line.text))?.text ?? fallbackClassName;
      const className = cleanCell(classLine.replace(/Class\s*:?\s*/i, "")).toUpperCase() || fallbackClassName;
      const studentId = normalizeRegNo(
        infoLines.find((line) => /Student Id/i.test(line.text))?.text.replace(/Student Id\s*:?\s*/i, "") ?? "",
      );
      const dob = toIsoDate(infoLines.find((line) => /DOB/i.test(line.text))?.text.replace(/DOB\s*:?\s*/i, "") ?? "");

      const phone = normalizeRegNo(parentLines.find((line) => /\d{10}/.test(line))?.match(/\d{10}/)?.[0] ?? "").slice(0, 10);
      const parentNames = parentLines.filter((line) => !/\d{10}/.test(line) && line !== ":");
      const fatherName = cleanCell(parentNames[0] ?? "").toUpperCase();
      const motherName = cleanCell(parentNames.slice(1).join(" "))?.toUpperCase() ?? "";

      const address = cleanCell(
        addressLines
          .filter((line) => !/Reg\.?Date|RFID/i.test(line))
          .join(", ")
          .replace(/\s*,\s*,/g, ", "),
      );
      const regDate = toIsoDate(
        addressLines
          .find((line) => /Reg\.?Date/i.test(line))
          ?.replace(/Reg\.?Date\s*/i, "")
          .replace(/\s+/g, "") ?? "",
      );

      const regNo = normalizeRegNo(regLines.join(" ").match(/[A-Za-z]{1,3}\d+/)?.[0] ?? studentId);
      if (!regNo) continue;

      const hostelRequired = /Hostel\s*:?\s*Yes/i.test(regLines.join(" ")) ? "Yes" : "No";
      parsed.set(regNo, {
        name,
        father_name: fatherName,
        mother_name: motherName,
        phone,
        dob,
        gender,
        class_name: className,
        session: "2025-2026",
        stream,
        student_group: stream,
        admission_date: regDate || IMPORT_DATE,
        reg_no: regNo,
        roll_no: studentId,
        address,
        district: inferDistrict(address),
        hostel_required: hostelRequired,
        status: "active",
        admission_fee: 0,
        coaching_fee: 0,
        transport: "No",
        transport_fee: 0,
        fooding: "No",
        fooding_fee: 0,
      });
    }
  }

  return [...parsed.values()];
}

async function parseAdmissionDuePdf(pdfPath: string) {
  const blocks = await extractPdfBlocks(pdfPath);
  const className = blocks.find((block) => /Admission Due List for Class/i.test(block.text))?.text.split(":").pop()?.trim().toUpperCase() ?? "XII";
  const stream = inferStreamFromClassName(className);
  const rows: DueRow[] = [];

  for (const page of new Set(blocks.map((block) => block.page))) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    const serials = pageBlocks.filter((block) => block.x >= 10 && block.x <= 18 && /^\d+$/.test(block.text) && block.y > 100);

    for (const serial of serials) {
      const row = pageBlocks.filter((block) => Math.abs(block.y - serial.y) <= 1.1);
      const regNo = normalizeRegNo(row.find((block) => block.x >= 50 && block.x < 120)?.text ?? "");
      const name = cleanCell(row.find((block) => block.x >= 130 && block.x < 360)?.text ?? "").toUpperCase();
      const father = cleanCell(row.find((block) => block.x >= 360 && block.x < 600)?.text ?? "").toUpperCase();
      const phone = row.find((block) => block.x >= 600 && block.x < 708)?.text.replace(/\D/g, "").slice(0, 10) ?? "";
      const amount = Number(row.find((block) => block.x >= 708)?.text.replace(/[^\d.]/g, "") ?? "0");

      if (!regNo || !name || !amount) continue;
      rows.push({
        reg_no: regNo,
        name,
        father_name: father,
        phone,
        class_name: className,
        stream,
        session: "2025-2026",
        amount,
        type: "Admission Fee",
      });
    }
  }

  return rows;
}

async function parseInstallmentDuePdf(pdfPath: string, className: string, stream: string) {
  const blocks = await extractPdfBlocks(pdfPath);
  const rows: DueRow[] = [];

  for (const page of new Set(blocks.map((block) => block.page))) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    const serials = pageBlocks.filter((block) => block.x >= 10 && block.x <= 18 && /^\d+$/.test(block.text) && block.y > 40);

    for (const serial of serials) {
      const row = pageBlocks.filter((block) => Math.abs(block.y - serial.y) <= 1.1);
      const regNo = normalizeRegNo(row.find((block) => block.x >= 60 && block.x < 130)?.text ?? "");
      const name = cleanCell(row.find((block) => block.x >= 140 && block.x < 370)?.text ?? "").toUpperCase();
      const phone = row.find((block) => block.x >= 370 && block.x < 480)?.text.replace(/\D/g, "").slice(0, 10) ?? "";
      const regAmount = Number(row.find((block) => block.x >= 480 && block.x < 586)?.text.replace(/[^\d.]/g, "") ?? "0");
      const paidAmount = Number(row.find((block) => block.x >= 586 && block.x < 695)?.text.replace(/[^\d.]/g, "") ?? "0");
      const totalDue = Number(row.find((block) => block.x >= 695)?.text.replace(/[^\d.]/g, "") ?? "0");

      if (!regNo || !name || !totalDue) continue;
      rows.push({
        reg_no: regNo,
        name,
        phone,
        class_name: className,
        stream,
        session: "2025-2026",
        amount: totalDue,
        type: "Installment Due",
        reference_no: `Reg Amount: ${regAmount || 0}, Net Paid: ${paidAmount || 0}`,
      });
    }
  }

  return rows;
}

async function parseOldDuePdf(pdfPath: string) {
  const blocks = await extractPdfBlocks(pdfPath);
  const rows: DueRow[] = [];

  for (const page of new Set(blocks.map((block) => block.page))) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    const regBlocks = pageBlocks
      .filter((block) => block.x >= 20 && block.x <= 35 && /^[A-Za-z]{1,3}\d+$/i.test(block.text))
      .sort((a, b) => a.y - b.y);

    for (let index = 0; index < regBlocks.length; index += 1) {
      const regBlock = regBlocks[index];
      const next = regBlocks[index + 1];
      const rowGroup = pageBlocks.filter((block) => block.y >= regBlock.y && (!next || block.y < next.y));
      const regNo = normalizeRegNo(regBlock.text);
      const name = cleanCell(
        uniqueLineStrings(rowGroup.filter((block) => block.x >= 80 && block.x < 190))
          .map((line) => line.text)
          .join(" "),
      ).toUpperCase();
      const phone = rowGroup.find((block) => block.x >= 190 && block.x < 275)?.text.replace(/\D/g, "").slice(0, 10) ?? "";
      const amount = Number(rowGroup.find((block) => block.x >= 275 && block.x < 340)?.text.replace(/[^\d.]/g, "") ?? "0");
      const className = cleanCell(
        uniqueLineStrings(rowGroup.filter((block) => block.x >= 340 && block.x < 390))
          .map((line) => line.text)
          .join(" "),
      ).toUpperCase();
      const dueType = mapOldDueType(
        uniqueLineStrings(rowGroup.filter((block) => block.x >= 390 && block.x < 515))
          .map((line) => line.text)
          .join(" "),
      );

      if (!regNo || !name || !amount || !className || !dueType) continue;
      rows.push({
        reg_no: regNo,
        name,
        phone,
        class_name: className,
        stream: inferStreamFromClassName(className),
        session: inferSessionFromRegNo(regNo),
        amount,
        type: dueType,
      });
    }
  }

  return rows;
}

async function parsePassoutPdf(pdfPath: string) {
  const blocks = await extractPdfBlocks(pdfPath);
  const students = new Map<string, LegacyStudentSeed>();

  for (const page of new Set(blocks.map((block) => block.page))) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    const idBlocks = pageBlocks
      .filter((block) => block.x >= 20 && block.x <= 120 && /Student Id\s*:/i.test(block.text))
      .sort((a, b) => a.y - b.y);

    for (let index = 0; index < idBlocks.length; index += 1) {
      const start = idBlocks[index];
      const next = idBlocks[index + 1];
      const rowBlocks = pageBlocks.filter((block) => block.y >= start.y && (!next || block.y < next.y));

      const id = cleanCell(start.text.replace(/Student Id\s*:/i, ""));
      const infoLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 20 && block.x < 250)).map((line) => line.text);
      const parentLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 250 && block.x < 455)).map((line) => line.text);
      const phoneLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 455 && block.x < 540)).map((line) => line.text);
      const addressLines = uniqueLineStrings(rowBlocks.filter((block) => block.x >= 540)).map((line) => line.text);

      const nameLine = infoLines.find((line) => /\[\s*(Male|Femal|Female)\s*\]/i.test(line));
      if (!nameLine) continue;

      const genderMatch = /\[\s*(Male|Femal|Female)\s*\]/i.exec(nameLine);
      const gender = genderMatch?.[1].toLowerCase().startsWith("f") ? "Female" : "Male";
      const name = cleanCell(nameLine.replace(/\[\s*(Male|Femal|Female)\s*\]/gi, "")).toUpperCase();
      const phone = phoneLines.join(" ").match(/\d{10}/)?.[0] ?? "";

      const syntheticRegNo = normalizeRegNo(`PASSOUT-${id}`);
      students.set(syntheticRegNo, {
        name,
        father_name: cleanCell(parentLines[0] ?? "").toUpperCase(),
        mother_name: cleanCell(parentLines[1] ?? "").toUpperCase(),
        phone,
        dob: "",
        gender,
        class_name: "PASSED OUT",
        session: "2025-2026",
        stream: "None",
        student_group: "None",
        admission_date: IMPORT_DATE,
        reg_no: syntheticRegNo,
        roll_no: id,
        address: cleanCell(addressLines.join(", ")),
        district: inferDistrict(addressLines.join(", ")),
        hostel_required: "No",
        status: "alumni",
        admission_fee: 0,
        coaching_fee: 0,
        transport: "No",
        transport_fee: 0,
        fooding: "No",
        fooding_fee: 0,
      });
    }
  }

  return [...students.values()];
}

async function backupExistingData() {
  const backupDir = path.resolve(process.cwd(), "backups");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(backupDir, { recursive: true });

  const [classes, students, fees, sessions, streams, ledgers] = await Promise.all([
    ClassModel.find().lean(),
    Student.find().lean(),
    Fee.find().lean(),
    AcademicSessionMaster.find().lean(),
    StreamMaster.find().lean(),
    FeeLedger.find().lean(),
  ]);

  const backupPath = path.join(backupDir, `legacy-import-backup-${timestamp}.json`);
  await fs.writeFile(
    backupPath,
    JSON.stringify(
      {
        created_at: new Date().toISOString(),
        classes,
        students,
        fees,
        sessions,
        streams,
        ledgers,
      },
      null,
      2,
    ),
  );

  return backupPath;
}

async function ensureClass(name: string) {
  const existing = await ClassModel.findOne({ name }).lean();
  if (existing) return existing;

  const id = await getNextSafeSequence("classes", ClassModel);
  return ClassModel.create({ id, name, batch_names: [] });
}

async function ensureSession(name: string) {
  const existing = await AcademicSessionMaster.findOne({ name }).lean();
  if (existing) return existing;

  const id = await getNextSafeSequence("academic-sessions", AcademicSessionMaster);
  return AcademicSessionMaster.create({ id, name, active: true });
}

async function ensureStream(name: string) {
  const existing = await StreamMaster.findOne({ name }).lean();
  if (existing) return existing;

  const id = await getNextSafeSequence("streams", StreamMaster);
  return StreamMaster.create({ id, name, active: true });
}

async function ensureLedger(name: string, description: string) {
  const existing = await FeeLedger.findOne({ name }).lean();
  if (existing) return existing;

  const id = await getNextSafeSequence("fee-ledgers", FeeLedger);
  return FeeLedger.create({ id, name, description, active: true });
}

async function ensureSubject(name: string, classId: number) {
  const existing = await Subject.findOne({ name, class_id: classId }).lean();
  if (existing) return existing;

  const id = await getNextSafeSequence("subjects", Subject);
  return Subject.create({ id, name, class_id: classId });
}

async function getNextSafeSequence(counterName: string, model: any) {
  const [seq, latest] = await Promise.all([
    getNextSequence(counterName),
    model.findOne().sort({ id: -1 }).lean(),
  ]);

  const maxExisting = Number(latest?.id ?? 0);
  if (seq > maxExisting) {
    return seq;
  }

  const next = maxExisting + 1;
  await Counter.findOneAndUpdate(
    { name: counterName },
    { $set: { seq: next } },
    { upsert: true },
  );
  return next;
}

function mergeDueIntoStudent(student: LegacyStudentSeed, due: DueRow) {
  if (!student.phone && due.phone) student.phone = due.phone;
  if (!student.father_name && due.father_name) student.father_name = due.father_name;
  if (due.type === "Admission Fee") {
    student.admission_fee = Math.max(student.admission_fee, due.amount);
  }
  if (due.type === "Food Fee") {
    student.fooding = "Yes";
    student.fooding_fee = Math.max(student.fooding_fee, due.amount);
  }
  if (due.type === "Transport Fee") {
    student.transport = "Yes";
    student.transport_fee = Math.max(student.transport_fee, due.amount);
  }
  if (due.type === "Coaching Fee") {
    student.coaching_fee = Math.max(student.coaching_fee, due.amount);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const activeStudents = [
    ...(await parseActiveStudentPdf(path.join(DATA_DIR, "ARTS.pdf"), "XII ARTS", "Arts")),
    ...(await parseActiveStudentPdf(path.join(DATA_DIR, "Science.pdf"), "XII SC", "Science")),
  ];
  const passoutStudents = await parsePassoutPdf(path.join(DATA_DIR, "2025-26.pdf"));
  const admissionDues = [
    ...(await parseAdmissionDuePdf(path.join(DATA_DIR, "Admission Due Arts.pdf"))),
    ...(await parseAdmissionDuePdf(path.join(DATA_DIR, "Admission Due Science.pdf"))),
  ];
  const installmentDues = [
    ...(await parseInstallmentDuePdf(path.join(DATA_DIR, "Installment Due Arts.pdf"), "XII ARTS", "Arts")),
    ...(await parseInstallmentDuePdf(path.join(DATA_DIR, "Installment Due Science.pdf"), "XII SC", "Science")),
  ];
  const oldDues = await parseOldDuePdf(path.join(DATA_DIR, "Old Due.pdf"));

  const studentsByReg = new Map<string, LegacyStudentSeed>();
  for (const student of activeStudents) {
    studentsByReg.set(student.reg_no, student);
  }

  const alumniByReg = new Map<string, LegacyStudentSeed>();
  for (const student of passoutStudents) {
    alumniByReg.set(student.reg_no, student);
  }

  const allDues = [...admissionDues, ...installmentDues, ...oldDues];
  for (const due of allDues) {
    const active = studentsByReg.get(due.reg_no);
    if (active) {
      mergeDueIntoStudent(active, due);
      continue;
    }

    const alumni = alumniByReg.get(due.reg_no);
    if (alumni) {
      mergeDueIntoStudent(alumni, due);
      continue;
    }

    const stream = due.stream || inferStreamFromClassName(due.class_name);
    alumniByReg.set(due.reg_no, {
      name: due.name,
      father_name: (due.father_name ?? "").toUpperCase(),
      mother_name: "",
      phone: due.phone ?? "",
      dob: "",
      gender: "Male",
      class_name: due.class_name,
      session: due.session,
      stream,
      student_group: stream,
      admission_date: IMPORT_DATE,
      reg_no: due.reg_no,
      roll_no: due.reg_no,
      address: "",
      district: "Ganjam",
      hostel_required: "No",
      status: "alumni",
      admission_fee: due.type === "Admission Fee" ? due.amount : 0,
      coaching_fee: due.type === "Coaching Fee" ? due.amount : 0,
      transport: due.type === "Transport Fee" ? "Yes" : "No",
      transport_fee: due.type === "Transport Fee" ? due.amount : 0,
      fooding: due.type === "Food Fee" ? "Yes" : "No",
      fooding_fee: due.type === "Food Fee" ? due.amount : 0,
    });
  }

  const allStudents = [...studentsByReg.values(), ...alumniByReg.values()];
  const validStudents = allStudents.filter((student) => student.name.trim() && student.reg_no.trim() && student.class_name.trim());
  const skippedStudents = allStudents.filter((student) => !student.name.trim() || !student.reg_no.trim() || !student.class_name.trim());
  const classNames = new Set(allStudents.map((student) => student.class_name));
  const sessions = new Set(allStudents.map((student) => student.session));
  const streams = new Set(
    allStudents
      .map((student) => student.stream)
      .filter((stream) => stream === "Arts" || stream === "Science"),
  );

  const feeRows: FeeSeed[] = [];
  let feeIndex = 1;
  for (const due of allDues) {
    feeRows.push({
      reg_no: due.reg_no,
      class_name: due.class_name,
      academic_session: due.session,
      amount: due.amount,
      type: due.type,
      date: IMPORT_DATE,
      status: "pending",
      mode: "Legacy Import",
      bill_no: `LEGACY-${String(feeIndex).padStart(5, "0")}`,
      reference_no: due.reference_no ?? "",
    });
    feeIndex += 1;
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "dry-run",
          students: {
            total: validStudents.length,
            active: validStudents.filter((student) => student.status === "active").length,
            alumni: validStudents.filter((student) => student.status === "alumni").length,
            skipped_invalid: skippedStudents.length,
          },
          fees: feeRows.length,
          classes: [...classNames].sort(),
          sessions: [...sessions].sort(),
          streams: [...streams].sort(),
          samples: {
            active: validStudents.filter((student) => student.status === "active").slice(0, 3),
            alumni: validStudents.filter((student) => student.status === "alumni").slice(0, 3),
            fees: feeRows.slice(0, 5),
            skipped: skippedStudents.slice(0, 10),
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  await connectToDatabase();
  const backupPath = await backupExistingData();

  await Promise.all([
    Attendance.deleteMany({}),
    ClassModel.deleteMany({}),
    Exam.deleteMany({}),
    Fee.deleteMany({}),
    FeeStructure.deleteMany({}),
    FoodTransaction.deleteMany({}),
    FoodWallet.deleteMany({}),
    Hostel.deleteMany({}),
    HostelAllotment.deleteMany({}),
    Mark.deleteMany({}),
    MedicalRecord.deleteMany({}),
    Room.deleteMany({}),
    Student.deleteMany({}),
    StreamMaster.deleteMany({}),
    Subject.deleteMany({}),
    Transaction.deleteMany({}),
    AcademicSessionMaster.deleteMany({}),
  ]);

  for (const sessionName of [...sessions].sort()) {
    await ensureSession(sessionName);
  }

  for (const streamName of [...streams].sort()) {
    await ensureStream(streamName);
  }

  for (const [name, description] of [
    ["Admission Fee", "Legacy admission due imported from the old ERP"],
    ["Installment Due", "Legacy installment due imported from the old ERP"],
    ["Coaching Fee", "Legacy coaching due imported from the old ERP"],
    ["Food Fee", "Legacy food due imported from the old ERP"],
    ["Hostel Fee", "Legacy hostel due imported from the old ERP"],
    ["Transport Fee", "Legacy transport due imported from the old ERP"],
  ] as const) {
    await ensureLedger(name, description);
  }

  const requiredClassNames = new Set([
    ...Object.keys(COLLEGE_CLASS_SUBJECTS),
    "PASSED OUT",
    ...validStudents.map((student) => student.class_name),
  ]);

  const classMap = new Map<string, number>();
  for (const className of [...requiredClassNames].sort()) {
    const classDoc = await ensureClass(className);
    classMap.set(className, classDoc.id);
  }

  for (const [className, subjectNames] of Object.entries(COLLEGE_CLASS_SUBJECTS)) {
    const classId = classMap.get(className);
    if (!classId) continue;

    for (const subjectName of subjectNames) {
      await ensureSubject(subjectName, classId);
    }
  }

  const studentIdByReg = new Map<string, number>();
  for (const student of validStudents) {
    const id = await getNextSequence("students");
    studentIdByReg.set(student.reg_no, id);
    await Student.create({
      id,
      name: student.name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      phone: student.phone,
      father_phone: student.phone,
      mother_phone: "",
      address: student.address,
      post: "",
      pin_code: "",
      thana: "",
      country: DEFAULT_COUNTRY,
      state: DEFAULT_STATE,
      district: student.district,
      landmark: "",
      email: "",
      dob: student.dob,
      age: ageFromDob(student.dob),
      gender: student.gender,
      class_id: classMap.get(student.class_name) ?? 0,
      section: "",
      session: student.session,
      category: "General",
      student_group: student.student_group,
      stream: student.stream,
      occupation: "",
      admission_date: student.admission_date || IMPORT_DATE,
      reg_no: student.reg_no,
      photo_url: student.photo_url ?? "",
      roll_no: student.roll_no,
      rfid_card_no: "",
      hostel_required: student.hostel_required,
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
      coaching_fee: student.coaching_fee,
      admission_fee: student.admission_fee,
      transport: student.transport,
      transport_fee: student.transport_fee,
      entrance: "No",
      entrance_fee: 0,
      fooding: student.fooding,
      fooding_fee: student.fooding_fee,
      status: student.status,
    });
  }

  for (const fee of feeRows) {
    const studentId = studentIdByReg.get(fee.reg_no);
    if (!studentId) continue;

    const id = await getNextSequence("fees");
    await Fee.create({
      id,
      student_id: studentId,
      academic_session: fee.academic_session,
      class_id: classMap.get(fee.class_name) ?? 0,
      amount: fee.amount,
      type: fee.type,
      date: fee.date,
      status: fee.status,
      discount: 0,
      mode: fee.mode,
      reference_no: fee.reference_no,
      bill_no: fee.bill_no,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        backup_path: backupPath,
        students: {
          total: validStudents.length,
          active: validStudents.filter((student) => student.status === "active").length,
          alumni: validStudents.filter((student) => student.status === "alumni").length,
          skipped_invalid: skippedStudents.length,
        },
        fees: feeRows.length,
        classes: [...new Set(validStudents.map((student) => student.class_name))].sort(),
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
