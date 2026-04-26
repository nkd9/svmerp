import fs from "node:fs/promises";
import path from "node:path";

type MenuGroup = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

type StudentReportCategory = "NonHostel" | "Hostel";

type LegacyClassMapping = {
  courseYear: string;
  stream: string;
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

type StudentReportRow = {
  serial_no: number;
  category: StudentReportCategory;
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

const BASE_URL = "https://svmclasses.com/Admissionschool";
const LOGIN_URL = "https://svmclasses.com/svmclasses.php";

class OldErpClient {
  private cookies = new Map<string, string>();

  async login(username: string, password: string) {
    await this.request(LOGIN_URL);
    const body = new URLSearchParams({
      uname: username,
      password,
      submit: "Sign In",
    });

    const response = await this.request(LOGIN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      redirect: "follow",
    });

    if (!/Admin Dashboard|Administrator|Dashboard/i.test(response)) {
      throw new Error("Old ERP login failed. Check username/password or site behavior.");
    }
  }

  async get(relativePath: string) {
    return this.request(this.url(relativePath));
  }

  async post(relativePath: string, form: Record<string, string>) {
    return this.request(this.url(relativePath), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
      redirect: "follow",
    });
  }

  private url(relativePath: string) {
    return relativePath.startsWith("http")
      ? relativePath
      : `${BASE_URL}/${relativePath.replace(/^\//, "")}`;
  }

  private async request(input: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    const cookieHeader = this.serializeCookies();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }
    if (!headers.has("user-agent")) {
      headers.set("user-agent", "svm-erp-migrator/1.0");
    }

    const response = await fetch(input, { ...init, headers });
    this.captureCookies(response);
    return response.text();
  }

  private captureCookies(response: Response) {
    const raw = (response.headers as any).getSetCookie?.() as string[] | undefined;
    const cookieLines = raw || splitCombinedSetCookie(response.headers.get("set-cookie") || "");
    for (const line of cookieLines) {
      const [pair] = line.split(";");
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) continue;
      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();
      if (!name) continue;
      this.cookies.set(name, value);
    }
  }

  private serializeCookies() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

function splitCombinedSetCookie(value: string) {
  if (!value) return [];
  return value.split(/,(?=[^;]+?=)/g).map((item) => item.trim()).filter(Boolean);
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function extractSelectOptions(html: string, selectName: string) {
  const selectMatch = html.match(new RegExp(`<select[^>]*name=["']${selectName}["'][^>]*>([\\s\\S]*?)</select>`, "i"));
  if (!selectMatch) return [];

  const optionMatches = [...selectMatch[1].matchAll(/<option[^>]*value\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/option>/gi)];
  return optionMatches
    .map((match) => ({
      value: decodeHtml(match[1] || match[2] || match[3] || ""),
      label: stripTags(match[4]),
    }))
    .filter((option) => option.value && option.value !== "showAll");
}

function extractMenuGroups(html: string): MenuGroup[] {
  const menuBlockMatch = html.match(/<!-- BEGIN SIDEBAR MENU -->([\s\S]*?)<!-- END SIDEBAR MENU -->/i);
  if (!menuBlockMatch) return [];

  const blocks = [...menuBlockMatch[1].matchAll(/<li class="sub-menu">([\s\S]*?)<\/li>\s*(?=<li class="sub-menu">|$)/gi)];
  return blocks
    .map((match) => {
      const block = match[1];
      const titleMatch = block.match(/<span>([\s\S]*?)<\/span>/i);
      const title = stripTags(titleMatch?.[1] || "");
      const links = [...block.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map((linkMatch) => ({
          href: decodeHtml(linkMatch[1]),
          label: stripTags(linkMatch[2]),
        }))
        .filter((link) => link.href !== "javascript:;" && link.label && link.label !== title);
      return { title, links };
    })
    .filter((group) => group.title);
}

function mapLegacyClass(className: string): LegacyClassMapping {
  const raw = stripTags(className).toUpperCase();
  if (raw === "XI") return { courseYear: "1st Year", stream: "None" };
  if (raw === "XII") return { courseYear: "2nd Year", stream: "None" };
  if (raw === "XI ARTS") return { courseYear: "1st Year", stream: "Arts" };
  if (raw === "XI SC") return { courseYear: "1st Year", stream: "Science" };
  if (raw === "XII ARTS") return { courseYear: "2nd Year", stream: "Arts" };
  if (raw === "XII SC") return { courseYear: "2nd Year", stream: "Science" };
  return { courseYear: stripTags(className), stream: "None" };
}

function mapLegacySession(session: string) {
  const trimmed = stripTags(session);
  const match = trimmed.match(/^(\d{4})-(\d{4})$/);
  if (!match) return trimmed;
  const startYear = Number(match[1]);
  return `${startYear}-${startYear + 2}`;
}

function toNumber(value: string) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractDescriptionType(description: string) {
  const lowered = description.toLowerCase();
  if (lowered.startsWith("admission")) return "Admission Fee";
  if (lowered.startsWith("old due collection") || lowered.startsWith("old outstanding due")) return "Old Due Collection";
  if (lowered.startsWith("coatching fee")) return "Coatching Fee";
  if (lowered.startsWith("food fee")) return "Food Fee";
  if (lowered.startsWith("hostel fee")) return "Hostel Fee";
  if (lowered.startsWith("transport fee")) return "Transport Fee";
  if (lowered.startsWith("entrance fee")) return "Entrance Fee";
  return description;
}

function extractRegNoFromDescription(description: string) {
  const match = description.match(/ID\s*([a-z0-9]+)/i);
  return match ? match[1].toUpperCase() : "";
}

function parseStudentReportRows(html: string, category: StudentReportCategory, className: string, session: string) {
  const rows: StudentReportRow[] = [];

  const tableMatch = html.match(/<table[^>]*id=["']editable-sample["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tableMatch) {
    return rows;
  }

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  const classMapping = mapLegacyClass(className);
  const mappedSession = mapLegacySession(session);

  for (const match of rowMatches) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cellMatch) => cellMatch[1]);
    if (cells.length < 6) {
      continue;
    }

    const serialNo = Number(stripTags(cells[0]));
    if (!Number.isFinite(serialNo)) continue;

    const studentInfo = cells[1];
    const parentInfo = cells[2];
    const addressInfo = cells[3];
    const regInfo = cells[4];
    const photoInfo = cells[5];

    const nameMatch = studentInfo.match(/^(.*?)&nbsp;\s*\((Male|Female)\)<br/i);
    const studentIdMatch = studentInfo.match(/Student Id\s*:\s*([^<]+)/i);
    const dobMatch = studentInfo.match(/DOB\s*:\s*([^<]+)/i);

    const parentParts = splitHtmlBreaks(parentInfo).map(stripTags);
    const addressWithoutMeta = addressInfo
      .replace(/<br\s*\/?>\s*Reg\.Date[\s\S]*$/i, "")
      .replace(/<strong>\s*RFID\s*<\/strong>\s*:[\s\S]*$/i, "");
    const addressParts = splitHtmlBreaks(addressWithoutMeta).map(stripTags);
    const regParts = splitHtmlBreaks(regInfo).map(stripTags);

    const regNoMatch = regInfo.match(/Regi\.\s*No\.\s*:\s*([^<]+)/i);
    const roomMatch = regInfo.match(/Room No:\s*:?\s*([^<]+)/i);
    const hostelRequiredMatch = regInfo.match(/Hostel\s*:\s*([^<]+)/i);
    const hostelLabelMatch = regInfo.match(/Hostel\s*:\s*([^<]+)<Br>Room No/i);
    const regDateMatch = addressInfo.match(/Reg\.Date\s*([^<]+)/i);
    const rfidMatch = addressInfo.match(/RFID\s*:\s*([^<]+)/i);
    const photoMatch = photoInfo.match(/<img\s+src=(.+?)\s+height=/i);

    const [addressLine1 = "", addressLine2 = ""] = addressParts;
    const addressTail = addressParts[addressParts.length - 1] || "";
    const districtPin = addressTail.includes("-") ? addressTail.split("-").pop() || "" : addressTail;
    const districtPinMatch = districtPin.trim().match(/^(.*?)(\d{6})?$/);

    rows.push({
      serial_no: serialNo,
      category,
      legacy_class_name: stripTags(className),
      legacy_session: session,
      mapped_course_year: classMapping.courseYear,
      mapped_stream: classMapping.stream,
      mapped_session: mappedSession,
      name: decodeHtml(nameMatch?.[1] || ""),
      gender: decodeHtml(nameMatch?.[2] || ""),
      legacy_student_id: stripTags(studentIdMatch?.[1] || ""),
      dob: stripTags(dobMatch?.[1] || ""),
      father_name: parentParts[0] || "",
      father_phone: parentParts[1] || "",
      mother_name: parentParts[2] || "",
      mother_phone: parentParts[3] || "",
      address_line_1: addressLine1,
      address_line_2: addressLine2,
      district: decodeHtml((districtPinMatch?.[1] || "").replace(/-$/, "").trim()),
      pin_code: decodeHtml(districtPinMatch?.[2] || ""),
      registration_date: stripTags(regDateMatch?.[1] || ""),
      rfid: stripTags(rfidMatch?.[1] || ""),
      hostel_label: stripTags(hostelLabelMatch?.[1] || ""),
      room_no: stripTags(roomMatch?.[1] || ""),
      hostel_required: stripTags(hostelRequiredMatch?.[1] || ""),
      reg_no: stripTags(regNoMatch?.[1] || "").toUpperCase(),
      photo_path: decodeHtml((photoMatch?.[1] || "").replace(/^['"]|['"]$/g, "")),
    });
  }

  return rows;
}

function splitHtmlBreaks(value: string) {
  return value.split(/<br\s*\/?>/i).map((part) => part.trim()).filter(Boolean);
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function writeJsonFile(filePath: string, data: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function runInventory(client: OldErpClient) {
  const html = await client.get("AdminHome.php");
  return {
    fetched_at: new Date().toISOString(),
    modules: extractMenuGroups(html),
  };
}

async function runStudentSnapshot(client: OldErpClient) {
  const categories: StudentReportCategory[] = ["NonHostel", "Hostel"];
  const snapshot = {
    fetched_at: new Date().toISOString(),
    categories: [] as Array<{
      category: StudentReportCategory;
      classes: string[];
      sessions: string[];
      rows: StudentReportRow[];
    }>,
  };

  for (const category of categories) {
    const listingHtml = await client.get(`StudentReport.php?category=${category}`);
    const classes = extractSelectOptions(listingHtml, "classname").map((item) => item.value);
    const sessions = extractSelectOptions(listingHtml, "studsession").map((item) => item.value);
    const rows: StudentReportRow[] = [];

    for (const className of classes) {
      for (const session of sessions) {
        const reportHtml = await client.post("StudentReportCon.php", {
          classname: className,
          studsession: session,
          category,
          customersubmit: "",
        });
        rows.push(...parseStudentReportRows(reportHtml, category, className, session));
      }
    }

    snapshot.categories.push({
      category,
      classes,
      sessions,
      rows,
    });
  }

  return snapshot;
}

async function runTransactionsSnapshot(client: OldErpClient) {
  const html = await client.post("TransactionReport.php", {
    Fromdate: "2025-01-01",
    todate: "2026-12-31",
    Transactiondetails: "All",
    customersubmit: "",
  });

  const rows = parseTransactionReportRows(html);
  return {
    fetched_at: new Date().toISOString(),
    filters: {
      from_date: "2025-01-01",
      to_date: "2026-12-31",
      category: "All",
    },
    total_rows: rows.length,
    rows,
  };
}

function parseTransactionReportRows(html: string) {
  const tableMatch = html.match(/<table[^>]*width=["']100%["'][^>]*border=["']1["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [] as LegacyTransactionRow[];

  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: LegacyTransactionRow[] = [];

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length !== 11) continue;
    if (!/^\d+$/.test(cells[0])) continue;

    const legacyClassName = cells[3];
    const classMapping = mapLegacyClass(legacyClassName);
    const description = cells[7];

    rows.push({
      serial_no: Number(cells[0]),
      legacy_transaction_id: cells[1],
      name: cells[2],
      legacy_class_name: legacyClassName,
      mapped_course_year: classMapping.courseYear,
      mapped_stream: classMapping.stream,
      credit_amount: toNumber(cells[4]),
      debit_amount: toNumber(cells[5]),
      mode: cells[6],
      description,
      transaction_type: extractDescriptionType(description),
      date: cells[8],
      received_by: cells[9],
      status: cells[10],
      reg_no: extractRegNoFromDescription(description),
    });
  }

  return rows;
}

async function runOldDueSnapshot(client: OldErpClient) {
  const html = await client.get("Oldduereport.php");
  const rows = parseOldDueRows(html);
  return {
    fetched_at: new Date().toISOString(),
    total_rows: rows.length,
    total_due_amount: rows.reduce((sum, row) => sum + row.due_amount, 0),
    rows,
  };
}

function parseOldDueRows(html: string) {
  const tableMatch = html.match(/<table[^>]*id=["']editable-sample["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [] as LegacyOldDueRow[];
  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: LegacyOldDueRow[] = [];

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length < 6) continue;
    if (/^id$/i.test(cells[0])) continue;
    if (/^total due$/i.test(cells[0])) continue;

    const legacyClassName = cells[4];
    const classMapping = mapLegacyClass(legacyClassName);
    rows.push({
      legacy_student_id: cells[0],
      name: cells[1],
      phone: cells[2],
      due_amount: toNumber(cells[3]),
      legacy_class_name: legacyClassName,
      mapped_course_year: classMapping.courseYear,
      mapped_stream: classMapping.stream,
      category: cells[5],
      reg_no: cells[0].toUpperCase(),
    });
  }

  return rows;
}

async function runAdmissionDueSnapshot(client: OldErpClient) {
  const baseHtml = await client.get("GenerateAdmissionDue.php");
  const classes = extractSelectOptions(baseHtml, "classname").map((item) => item.value);
  const rows: LegacyAdmissionDueRow[] = [];

  for (const className of classes) {
    const html = await client.post("GenerateAdmissionDue.php", {
      classname: className,
      customersubmit: "",
    });
    rows.push(...parseAdmissionDueRows(html, className));
  }

  return {
    fetched_at: new Date().toISOString(),
    classes,
    total_rows: rows.length,
    total_due_amount: rows.reduce((sum, row) => sum + row.due_amount, 0),
    rows,
  };
}

function parseAdmissionDueRows(html: string, className: string) {
  const tableMatch = html.match(/<table[^>]*id=["']editable-sample["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [] as LegacyAdmissionDueRow[];
  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: LegacyAdmissionDueRow[] = [];
  const classMapping = mapLegacyClass(className);

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length < 6) continue;
    if (!/^\d+$/.test(cells[0])) continue;

    rows.push({
      serial_no: Number(cells[0]),
      reg_no: cells[1].toUpperCase(),
      name: cells[2],
      father_name: cells[3],
      phone: cells[4],
      due_amount: toNumber(cells[5]),
      legacy_class_name: className,
      mapped_course_year: classMapping.courseYear,
      mapped_stream: classMapping.stream,
    });
  }

  return rows;
}

async function runInstallmentDueSnapshot(client: OldErpClient) {
  const baseHtml = await client.get("GenerateInstallmentDue.php");
  const classes = extractSelectOptions(baseHtml, "classname").map((item) => item.value);
  const sessions = extractSelectOptions(baseHtml, "studsession").map((item) => item.value);
  const hostelStatuses = ["All", "Yes", "No"];
  const rows: LegacyInstallmentDueRow[] = [];

  for (const session of sessions) {
    for (const className of classes) {
      for (const hostelStatus of hostelStatuses) {
        const html = await client.post("GenerateInstallmentDue.php", {
          studsession: session,
          classname: className,
          Hostelstatus: hostelStatus,
          customersubmit: "",
        });
        rows.push(...parseInstallmentDueRows(html, className, session, hostelStatus));
      }
    }
  }

  const deduped = dedupeInstallmentRows(rows);
  return {
    fetched_at: new Date().toISOString(),
    classes,
    sessions,
    total_rows: deduped.length,
    total_due_amount: deduped.reduce((sum, row) => sum + row.total_due, 0),
    rows: deduped,
  };
}

function parseInstallmentDueRows(html: string, className: string, session: string, hostelStatus: string) {
  const tableMatch = html.match(/<table[^>]*class=["'][^"']*table-bordered[^"']*table-striped[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [] as LegacyInstallmentDueRow[];
  const rowMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: LegacyInstallmentDueRow[] = [];
  const classMapping = mapLegacyClass(className);
  const mappedSession = mapLegacySession(session);

  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]));
    if (cells.length < 7) continue;
    if (!/^\d+$/.test(cells[0])) continue;

    rows.push({
      serial_no: Number(cells[0]),
      reg_no: cells[1].toUpperCase(),
      name: cells[2],
      parent_phone: cells[3],
      reg_amount: toNumber(cells[4]),
      net_paid_amount: toNumber(cells[5]),
      total_due: toNumber(cells[6]),
      legacy_class_name: className,
      mapped_course_year: classMapping.courseYear,
      mapped_stream: classMapping.stream,
      legacy_session: session,
      mapped_session: mappedSession,
      hostel_status: hostelStatus,
    });
  }

  return rows;
}

function dedupeInstallmentRows(rows: LegacyInstallmentDueRow[]) {
  const grouped = new Map<string, LegacyInstallmentDueRow>();
  for (const row of rows) {
    const key = `${row.reg_no}|${row.legacy_class_name}|${row.legacy_session}`;
    const existing = grouped.get(key);
    if (!existing || (existing.hostel_status === "All" ? false : row.hostel_status === "All")) {
      grouped.set(key, row);
    }
  }
  return [...grouped.values()];
}

async function main() {
  const command = process.argv[2] || "inventory";
  const outputPath = process.argv[3] || "";

  const username = getEnv("OLD_ERP_USERNAME");
  const password = getEnv("OLD_ERP_PASSWORD");
  const client = new OldErpClient();
  await client.login(username, password);

  let payload: unknown;
  if (command === "inventory") {
    payload = await runInventory(client);
  } else if (command === "students") {
    payload = await runStudentSnapshot(client);
  } else if (command === "transactions") {
    payload = await runTransactionsSnapshot(client);
  } else if (command === "old-due") {
    payload = await runOldDueSnapshot(client);
  } else if (command === "admission-due") {
    payload = await runAdmissionDueSnapshot(client);
  } else if (command === "installment-due") {
    payload = await runInstallmentDueSnapshot(client);
  } else {
    throw new Error(`Unsupported command: ${command}`);
  }

  if (outputPath) {
    await writeJsonFile(outputPath, payload);
    console.log(`Wrote ${command} output to ${outputPath}`);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
