const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_STATE_KEY = process.env.SUPABASE_STATE_KEY || "cham-cong-quan";
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const WIFI_NAME = process.env.CAFE_WIFI_NAME || "The -Cha";
const REQUIRE_WIFI = false;

const sessions = new Map();
const demoData = {
  admin: { code: "admin", pin: "123456", name: "Quản trị viên" },
  employees: [
    { id: "e1", code: "NV001", pin: "1111", name: "Linh Trần", type: "hourly", rate: 35000 },
    { id: "e2", code: "NV002", pin: "2222", name: "Minh Phạm", type: "monthly", rate: 8500000 },
    { id: "e3", code: "NV003", pin: "3333", name: "An Nguyễn", type: "hourly", rate: 42000 }
  ],
  shifts: [],
  penalties: [],
  bonuses: []
};

let data = structuredClone(demoData);

function loadLocalData() {
  if (!fs.existsSync(DATA_FILE)) return structuredClone(demoData);
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return structuredClone(demoData);
  }
}

async function loadSupabaseData() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?key=eq.${encodeURIComponent(SUPABASE_STATE_KEY)}&select=value`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!response.ok) throw new Error(`Không đọc được dữ liệu Supabase: ${response.status}`);
  const rows = await response.json();
  return rows[0]?.value || null;
}

async function saveSupabaseData() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      key: SUPABASE_STATE_KEY,
      value: data,
      updated_at: new Date().toISOString()
    })
  });
  if (!response.ok) throw new Error(`Không lưu được dữ liệu Supabase: ${response.status}`);
}

async function loadData() {
  if (USE_SUPABASE) {
    const remoteData = await loadSupabaseData();
    if (remoteData) return remoteData;
  }
  return loadLocalData();
}

async function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  if (USE_SUPABASE) await saveSupabaseData();
}

async function initializeData() {
  data = await loadData();
  let changed = false;
  if (!data.admin) {
    data.admin = { code: "admin", pin: "123456", name: "Quản trị viên" };
    changed = true;
  }
  if (!Array.isArray(data.employees)) {
    data.employees = [];
    changed = true;
  }
  if (!Array.isArray(data.shifts)) {
    data.shifts = [];
    changed = true;
  }
  if (!Array.isArray(data.penalties)) {
    data.penalties = [];
    changed = true;
  }
  if (!Array.isArray(data.bonuses)) {
    data.bonuses = [];
    changed = true;
  }
  if (data.shifts.length === 0 && data.employees.length > 0) {
    data.shifts = [
      sampleShift(data.employees[0].id, -3, "08:02", "13:10"),
      sampleShift(data.employees[0].id, -2, "17:04", "22:15")
    ];
    changed = true;
  }
  if (changed || USE_SUPABASE) await saveData();
}

function sampleShift(employeeId, dayOffset, start, end) {
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const checkIn = new Date(base);
  checkIn.setHours(startHour, startMinute, 0, 0);
  const checkOut = new Date(base);
  checkOut.setHours(endHour, endMinute, 0, 0);
  return { id: makeId(), employeeId, checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString() };
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
}

function normalizeIp(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const realIp = request.headers["x-real-ip"];
  const ip = String(forwardedIp || realIp || request.socket.remoteAddress || "")
    .split(",")[0]
    .trim();
  return ip.replace(/^::ffff:/, "");
}

function wifiStatus(request) {
  const ip = normalizeIp(request);
  return { allowed: true, ip, networkName: WIFI_NAME, requireWifi: REQUIRE_WIFI, matchedPrefix: "" };
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

function getSession(request) {
  const sid = parseCookies(request).sid;
  return sid ? sessions.get(sid) : null;
}

function setSession(response, session) {
  const sid = makeId();
  sessions.set(sid, session);
  response.setHeader("Set-Cookie", `sid=${encodeURIComponent(sid)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSession(request, response) {
  const sid = parseCookies(request).sid;
  if (sid) sessions.delete(sid);
  response.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
}

function publicEmployee(employee) {
  const { pin, ...safeEmployee } = employee;
  return safeEmployee;
}

function updateSessionName(request, name) {
  const sid = parseCookies(request).sid;
  const session = sid ? sessions.get(sid) : null;
  if (session) session.name = name;
}

function monthParts(month) {
  const match = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (match) return { year: Number(match[1]), month: Number(match[2]) - 1, key: `${match[1]}-${match[2]}` };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` };
}

function isInMonth(value, selectedMonth) {
  const date = new Date(value);
  return date.getMonth() === selectedMonth.month && date.getFullYear() === selectedMonth.year;
}

function currentMonthShifts(employeeId, selectedMonth = monthParts()) {
  return data.shifts.filter((shift) => {
    return shift.employeeId === employeeId && isInMonth(shift.checkIn, selectedMonth);
  });
}

function shiftHours(shift) {
  if (!shift.checkOut) return 0;
  return Math.max(0, (new Date(shift.checkOut) - new Date(shift.checkIn)) / 36e5);
}

function daysInMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function openShift(employeeId) {
  return data.shifts.find((shift) => shift.employeeId === employeeId && !shift.checkOut);
}

function employeePay(employee, selectedMonth = monthParts()) {
  const grossPay = employeeGrossPay(employee, selectedMonth);
  return Math.max(0, grossPay + employeeBonusTotal(employee.id, selectedMonth) - employeePenaltyTotal(employee.id, selectedMonth));
}

function employeeGrossPay(employee, selectedMonth = monthParts()) {
  if (employee.type === "monthly") {
    return employee.rate;
  }
  return currentMonthShifts(employee.id, selectedMonth).reduce((total, shift) => total + shiftHours(shift) * employee.rate, 0);
}

function currentMonthPenalties(employeeId, selectedMonth = monthParts()) {
  return data.penalties.filter((penalty) => {
    return penalty.employeeId === employeeId && isInMonth(penalty.createdAt, selectedMonth);
  });
}

function currentMonthAllPenalties(selectedMonth = monthParts()) {
  return data.penalties.filter((penalty) => {
    return isInMonth(penalty.createdAt, selectedMonth);
  });
}

function currentMonthBonuses(employeeId, selectedMonth = monthParts()) {
  return data.bonuses.filter((bonus) => {
    return bonus.employeeId === employeeId && isInMonth(bonus.createdAt, selectedMonth);
  });
}

function currentMonthAllBonuses(selectedMonth = monthParts()) {
  return data.bonuses.filter((bonus) => {
    return isInMonth(bonus.createdAt, selectedMonth);
  });
}

function employeePenaltyTotal(employeeId, selectedMonth = monthParts()) {
  return currentMonthPenalties(employeeId, selectedMonth).reduce((total, penalty) => total + Number(penalty.amount || 0), 0);
}

function employeeBonusTotal(employeeId, selectedMonth = monthParts()) {
  return currentMonthBonuses(employeeId, selectedMonth).reduce((total, bonus) => total + Number(bonus.amount || 0), 0);
}

function employeeHours(employeeId, selectedMonth = monthParts()) {
  return currentMonthShifts(employeeId, selectedMonth).reduce((total, shift) => total + shiftHours(shift), 0);
}

function metrics() {
  const today = new Date().toDateString();
  return {
    todayCheckins: data.shifts.filter((shift) => new Date(shift.checkIn).toDateString() === today).length,
    activeShifts: data.shifts.filter((shift) => !shift.checkOut).length,
    payrollTotal: data.employees.reduce((sum, employee) => sum + employeePay(employee), 0)
  };
}

function employeeDashboard(employeeId) {
  const employee = data.employees.find((item) => item.id === employeeId);
  if (!employee) return null;
  const shifts = currentMonthShifts(employee.id)
    .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn))
    .map((shift) => ({
        ...shift,
        hours: shiftHours(shift),
        pay: employee.type === "monthly" ? 0 : shiftHours(shift) * employee.rate
      }));
  const penaltyTotal = employeePenaltyTotal(employee.id);
  const bonusTotal = employeeBonusTotal(employee.id);
  return {
    employee: publicEmployee(employee),
    shifts,
    penalties: currentMonthPenalties(employee.id),
    bonuses: currentMonthBonuses(employee.id),
    openShift: openShift(employee.id) || null,
    totals: { hours: employeeHours(employee.id), grossPay: employeeGrossPay(employee), bonusTotal, penaltyTotal, pay: employeePay(employee) },
    metrics: metrics()
  };
}

function adminDashboard(month) {
  const selectedMonth = monthParts(month);
  const employees = data.employees.map((employee) => ({
      ...publicEmployee(employee),
      hours: employeeHours(employee.id, selectedMonth),
      grossPay: employeeGrossPay(employee, selectedMonth),
      bonusTotal: employeeBonusTotal(employee.id, selectedMonth),
      penaltyTotal: employeePenaltyTotal(employee.id, selectedMonth),
      pay: employeePay(employee, selectedMonth)
    }));
  return {
    month: selectedMonth.key,
    employees,
    totals: employees.reduce((total, employee) => ({
      hours: total.hours + employee.hours,
      grossPay: total.grossPay + employee.grossPay,
      bonusTotal: total.bonusTotal + employee.bonusTotal,
      penaltyTotal: total.penaltyTotal + employee.penaltyTotal,
      pay: total.pay + employee.pay
    }), { hours: 0, grossPay: 0, bonusTotal: 0, penaltyTotal: 0, pay: 0 }),
    shiftDetails: data.shifts
      .filter((shift) => {
        return isInMonth(shift.checkIn, selectedMonth);
      })
      .map((shift) => {
        const employee = data.employees.find((item) => item.id === shift.employeeId);
        if (!employee) return null;
        const hours = shiftHours(shift);
        return {
          id: shift.id,
          employeeId: employee.id,
          employeeName: employee.name,
          employeeCode: employee.code,
          type: employee.type,
          rate: employee.rate,
          checkIn: shift.checkIn,
          checkOut: shift.checkOut,
          hours,
          pay: employee.type === "monthly" ? 0 : hours * employee.rate
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn)),
    penalties: currentMonthAllPenalties(selectedMonth)
      .map((penalty) => {
        const employee = data.employees.find((item) => item.id === penalty.employeeId);
        if (!employee) return null;
        return {
          ...penalty,
          employeeName: employee.name,
          employeeCode: employee.code
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    bonuses: currentMonthAllBonuses(selectedMonth)
      .map((bonus) => {
        const employee = data.employees.find((item) => item.id === bonus.employeeId);
        if (!employee) return null;
        return {
          ...bonus,
          employeeName: employee.name,
          employeeCode: employee.code
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    metrics: metrics()
  };
}

function requireEmployee(request, response) {
  const session = getSession(request);
  if (!session || session.role !== "employee") {
    sendJson(response, 401, { message: "Bạn cần đăng nhập tài khoản nhân viên." });
    return null;
  }
  return session;
}

function requireAdmin(request, response) {
  const session = getSession(request);
  if (!session || session.role !== "admin") {
    sendJson(response, 401, { message: "Bạn cần đăng nhập tài khoản quản trị." });
    return null;
  }
  return session;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendCsv(response, csv) {
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": "attachment; filename=bao-cao-luong.csv"
  });
  response.end(`\ufeff${csv}`);
}

function sendXlsx(response, workbookBuffer) {
  response.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": "attachment; filename=bao-cao-luong.xlsx"
  });
  response.end(workbookBuffer);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let name = "";
  let number = index;
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function sheetXml(rows) {
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((cell, cellIndex) => {
      const ref = `${columnName(cellIndex + 1)}${rowIndex + 1}`;
      if (typeof cell === "number") return `<c r="${ref}"><v>${Number.isFinite(cell) ? cell : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const dataBuffer = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data, "utf8");
    const crc = crc32(dataBuffer);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuffer.length, 18);
    local.writeUInt32LE(dataBuffer.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, dataBuffer);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuffer.length, 20);
    central.writeUInt32LE(dataBuffer.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + dataBuffer.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBuffer, end]);
}

function buildPayrollWorkbook(month) {
  const dashboard = adminDashboard(month);
  const summaryRows = [
    ["Bảng lương tổng hợp"],
    ["Nhân viên", "Tên đăng nhập", "Loại lương", "Mức lương", "Giờ công", "Lương trước phạt", "Tổng thưởng", "Tổng phạt", "Lương còn lại"],
    ...dashboard.employees.map((employee) => [
      employee.name,
      employee.code,
      employee.type === "monthly" ? "Toàn thời gian" : "Theo giờ",
      employee.rate,
      Number(employee.hours.toFixed(2)),
      Math.round(employee.grossPay),
      Math.round(employee.bonusTotal),
      Math.round(employee.penaltyTotal),
      Math.round(employee.pay)
    ])
  ];
  const detailRows = [
    ["Bảng lương chi tiết"],
    ["Nhân viên", "Tên đăng nhập", "Ngày giờ vào", "Ngày giờ ra", "Số giờ", "Loại lương", "Lương ca"],
    ...dashboard.shiftDetails.map((shift) => [
      shift.employeeName,
      shift.employeeCode,
      shift.checkIn,
      shift.checkOut || "",
      Number(shift.hours.toFixed(2)),
      shift.type === "monthly" ? "Toàn thời gian" : "Theo giờ",
      Math.round(shift.pay)
    ])
  ];
  const penaltyRows = [
    ["Danh sách phạt"],
    ["Nhân viên", "Tên đăng nhập", "Ngày phạt", "Mức phạt", "Lý do"],
    ...dashboard.penalties.map((penalty) => [
      penalty.employeeName,
      penalty.employeeCode,
      penalty.createdAt,
      Math.round(Number(penalty.amount || 0)),
      penalty.reason
    ])
  ];
  const bonusRows = [
    ["Danh sách thưởng"],
    ["Nhân viên", "Tên đăng nhập", "Ngày thưởng", "Mức thưởng", "Lý do"],
    ...dashboard.bonuses.map((bonus) => [
      bonus.employeeName,
      bonus.employeeCode,
      bonus.createdAt,
      Math.round(Number(bonus.amount || 0)),
      bonus.reason
    ])
  ];

  return zipStore([
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Tong hop" sheetId="1" r:id="rId1"/>
    <sheet name="Chi tiet cham cong" sheetId="2" r:id="rId2"/>
    <sheet name="Phat luong" sheetId="3" r:id="rId3"/>
    <sheet name="Thuong luong" sheetId="4" r:id="rId4"/>
  </sheets>
</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
</Relationships>` },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml(summaryRows) },
    { name: "xl/worksheets/sheet2.xml", data: sheetXml(detailRows) },
    { name: "xl/worksheets/sheet3.xml", data: sheetXml(penaltyRows) },
    { name: "xl/worksheets/sheet4.xml", data: sheetXml(bonusRows) }
  ]);
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    const type = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png"
    }[ext] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(content);
  });
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathName = url.pathname;

  try {
    if (request.method === "GET" && pathName === "/api/session") {
      sendJson(response, 200, { session: getSession(request), wifi: wifiStatus(request) });
      return;
    }

    if (request.method === "POST" && pathName === "/api/login") {
      const body = await readBody(request);
      if (body.role === "admin" && body.code === data.admin.code && body.pin === data.admin.pin) {
        setSession(response, { role: "admin", name: data.admin.name });
        sendJson(response, 200, { ok: true });
        return;
      }
      const employee = data.employees.find((item) => item.code === body.code && item.pin === body.pin);
      if (body.role === "employee" && employee) {
        setSession(response, { role: "employee", employeeId: employee.id, name: employee.name });
        sendJson(response, 200, { ok: true });
        return;
      }
      sendJson(response, 401, { message: "Th\u00f4ng tin \u0111\u0103ng nh\u1eadp kh\u00f4ng \u0111\u00fang." });
      return;
    }

    if (request.method === "POST" && pathName === "/api/change-password") {
      const session = getSession(request);
      if (!session) {
        sendJson(response, 401, { message: "B\u1ea1n c\u1ea7n \u0111\u0103ng nh\u1eadp tr\u01b0\u1edbc khi \u0111\u1ed5i m\u1eadt kh\u1ea9u." });
        return;
      }
      const body = await readBody(request);
      const currentPin = String(body.currentPin || "");
      const newPin = String(body.newPin || "");
      if (!currentPin || !newPin) {
        sendJson(response, 400, { message: "Vui l\u00f2ng nh\u1eadp m\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i v\u00e0 m\u1eadt kh\u1ea9u m\u1edbi." });
        return;
      }
      if (newPin.length < 4) {
        sendJson(response, 400, { message: "M\u1eadt kh\u1ea9u m\u1edbi c\u1ea7n c\u00f3 \u00edt nh\u1ea5t 4 k\u00fd t\u1ef1." });
        return;
      }
      if (session.role === "admin") {
        if (data.admin.pin !== currentPin) {
          sendJson(response, 401, { message: "M\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i kh\u00f4ng \u0111\u00fang." });
          return;
        }
        data.admin.pin = newPin;
        await saveData();
        updateSessionName(request, data.admin.name);
        sendJson(response, 200, { message: "\u0110\u00e3 \u0111\u1ed5i m\u1eadt kh\u1ea9u qu\u1ea3n tr\u1ecb." });
        return;
      }
      if (session.role === "employee") {
        const employee = data.employees.find((item) => item.id === session.employeeId);
        if (!employee) {
          sendJson(response, 404, { message: "Kh\u00f4ng t\u00ecm th\u1ea5y t\u00e0i kho\u1ea3n nh\u00e2n vi\u00ean." });
          return;
        }
        if (employee.pin !== currentPin) {
          sendJson(response, 401, { message: "M\u1eadt kh\u1ea9u hi\u1ec7n t\u1ea1i kh\u00f4ng \u0111\u00fang." });
          return;
        }
        employee.pin = newPin;
        await saveData();
        updateSessionName(request, employee.name);
        sendJson(response, 200, { message: "\u0110\u00e3 \u0111\u1ed5i m\u1eadt kh\u1ea9u nh\u00e2n vi\u00ean." });
        return;
      }
      sendJson(response, 403, { message: "T\u00e0i kho\u1ea3n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p \u0111\u1ed5i m\u1eadt kh\u1ea9u." });
      return;
    }

    if (request.method === "POST" && pathName === "/api/logout") {
      clearSession(request, response);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathName === "/api/employee-dashboard") {
      const session = requireEmployee(request, response);
      if (!session) return;
      sendJson(response, 200, employeeDashboard(session.employeeId));
      return;
    }

    if (request.method === "POST" && pathName === "/api/check-in") {
      const session = requireEmployee(request, response);
      if (!session) return;
      if (openShift(session.employeeId)) {
        sendJson(response, 409, { message: "Bạn đang trong ca, không thể vào ca lần nữa." });
        return;
      }
      data.shifts.push({ id: makeId(), employeeId: session.employeeId, checkIn: new Date().toISOString(), checkOut: null });
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && pathName === "/api/check-out") {
      const session = requireEmployee(request, response);
      if (!session) return;
      const shift = openShift(session.employeeId);
      if (!shift) {
        sendJson(response, 409, { message: "Bạn chưa có ca đang làm." });
        return;
      }
      shift.checkOut = new Date().toISOString();
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathName === "/api/admin-dashboard") {
      if (!requireAdmin(request, response)) return;
      sendJson(response, 200, adminDashboard(url.searchParams.get("month")));
      return;
    }

    if (request.method === "POST" && pathName === "/api/employees") {
      if (!requireAdmin(request, response)) return;
      const body = await readBody(request);
      if (!body.name || !body.code || !body.pin || !body.rate) {
        sendJson(response, 400, { message: "Vui lòng nhập đủ họ tên, mã nhân viên, PIN và mức lương." });
        return;
      }
      if (data.employees.some((employee) => employee.code === body.code)) {
        sendJson(response, 409, { message: "Mã nhân viên đã tồn tại." });
        return;
      }
      data.employees.push({ id: makeId(), name: body.name, code: body.code, pin: body.pin, type: body.type === "monthly" ? "monthly" : "hourly", rate: Number(body.rate) });
      await saveData();
      sendJson(response, 201, { ok: true });
      return;
    }

    const employeeMatch = pathName.match(/^\/api\/employees\/([^/]+)$/);
    if (employeeMatch && request.method === "PATCH") {
      if (!requireAdmin(request, response)) return;
      const employee = data.employees.find((item) => item.id === employeeMatch[1]);
      if (!employee) {
        sendJson(response, 404, { message: "Không tìm thấy nhân viên." });
        return;
      }
      const body = await readBody(request);
      if (body.type) employee.type = body.type === "monthly" ? "monthly" : "hourly";
      if (body.rate !== undefined) employee.rate = Number(body.rate) || 0;
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (employeeMatch && request.method === "DELETE") {
      if (!requireAdmin(request, response)) return;
      data.employees = data.employees.filter((item) => item.id !== employeeMatch[1]);
      data.shifts = data.shifts.filter((shift) => shift.employeeId !== employeeMatch[1]);
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    const shiftMatch = pathName.match(/^\/api\/shifts\/([^/]+)$/);
    if (shiftMatch && request.method === "PATCH") {
      if (!requireAdmin(request, response)) return;
      const shift = data.shifts.find((item) => item.id === shiftMatch[1]);
      if (!shift) {
        sendJson(response, 404, { message: "Không tìm thấy ca làm." });
        return;
      }
      const body = await readBody(request);
      if (body.checkIn) shift.checkIn = new Date(body.checkIn).toISOString();
      if (body.checkOut === null || body.checkOut === "") {
        shift.checkOut = null;
      } else if (body.checkOut) {
        shift.checkOut = new Date(body.checkOut).toISOString();
      }
      if (shift.checkOut && new Date(shift.checkOut) < new Date(shift.checkIn)) {
        sendJson(response, 400, { message: "Giờ ra không được nhỏ hơn giờ vào." });
        return;
      }
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (shiftMatch && request.method === "DELETE") {
      if (!requireAdmin(request, response)) return;
      const shift = data.shifts.find((item) => item.id === shiftMatch[1]);
      if (!shift) {
        sendJson(response, 404, { message: "Không tìm thấy ca làm." });
        return;
      }
      data.shifts = data.shifts.filter((item) => item.id !== shiftMatch[1]);
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && pathName === "/api/penalties") {
      if (!requireAdmin(request, response)) return;
      const body = await readBody(request);
      const employee = data.employees.find((item) => item.id === body.employeeId);
      const amount = Number(body.amount);
      if (!employee || !amount || amount <= 0 || !String(body.reason || "").trim()) {
        sendJson(response, 400, { message: "Vui lòng chọn nhân viên, nhập mức phạt và lý do phạt." });
        return;
      }
      data.penalties.push({
        id: makeId(),
        employeeId: employee.id,
        amount,
        reason: String(body.reason).trim(),
        createdAt: new Date().toISOString()
      });
      await saveData();
      sendJson(response, 201, { ok: true });
      return;
    }

    const penaltyMatch = pathName.match(/^\/api\/penalties\/([^/]+)$/);
    if (penaltyMatch && request.method === "DELETE") {
      if (!requireAdmin(request, response)) return;
      data.penalties = data.penalties.filter((penalty) => penalty.id !== penaltyMatch[1]);
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && pathName === "/api/bonuses") {
      if (!requireAdmin(request, response)) return;
      const body = await readBody(request);
      const employee = data.employees.find((item) => item.id === body.employeeId);
      const amount = Number(body.amount);
      if (!employee || !amount || amount <= 0 || !String(body.reason || "").trim()) {
        sendJson(response, 400, { message: "Vui lòng chọn nhân viên, nhập mức thưởng và lý do thưởng." });
        return;
      }
      data.bonuses.push({
        id: makeId(),
        employeeId: employee.id,
        amount,
        reason: String(body.reason).trim(),
        createdAt: new Date().toISOString()
      });
      await saveData();
      sendJson(response, 201, { ok: true });
      return;
    }

    const bonusMatch = pathName.match(/^\/api\/bonuses\/([^/]+)$/);
    if (bonusMatch && request.method === "DELETE") {
      if (!requireAdmin(request, response)) return;
      data.bonuses = data.bonuses.filter((bonus) => bonus.id !== bonusMatch[1]);
      await saveData();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && pathName === "/api/report.xlsx") {
      if (!requireAdmin(request, response)) return;
      sendXlsx(response, buildPayrollWorkbook(url.searchParams.get("month")));
      return;
    }

    if (request.method === "GET" && pathName === "/api/report.csv") {
      if (!requireAdmin(request, response)) return;
      const dashboard = adminDashboard(url.searchParams.get("month"));
      const rows = [
        ["Nhân viên", "Tên đăng nhập", "Loại lương", "Mức lương", "Giờ công", "Lương trước phạt", "Tổng thưởng", "Tổng phạt", "Lương còn lại"],
        ...dashboard.employees.map((employee) => [
          employee.name,
          employee.code,
          employee.type === "monthly" ? "Toàn thời gian" : "Theo giờ",
          employee.rate,
          employee.hours.toFixed(2),
          Math.round(employee.grossPay),
          Math.round(employee.bonusTotal),
          Math.round(employee.penaltyTotal),
          Math.round(employee.pay)
        ])
      ];
      rows.push([]);
      rows.push(["Chi tiết chấm công"]);
      rows.push(["Nhân viên", "Tên đăng nhập", "Ngày giờ vào", "Ngày giờ ra", "Số giờ", "Loại lương", "Lương ca"]);
      rows.push(
        ...dashboard.shiftDetails.map((shift) => [
          shift.employeeName,
          shift.employeeCode,
          shift.checkIn,
          shift.checkOut || "",
          shift.hours.toFixed(2),
          shift.type === "monthly" ? "Toàn thời gian" : "Theo giờ",
          Math.round(shift.pay)
        ])
      );
      rows.push([]);
      rows.push(["Danh sách phạt"]);
      rows.push(["Nhân viên", "Tên đăng nhập", "Ngày phạt", "Mức phạt", "Lý do"]);
      rows.push(
        ...dashboard.penalties.map((penalty) => [
          penalty.employeeName,
          penalty.employeeCode,
          penalty.createdAt,
          Math.round(Number(penalty.amount || 0)),
          penalty.reason
        ])
      );
      rows.push([]);
      rows.push(["Danh sách thưởng"]);
      rows.push(["Nhân viên", "Tên đăng nhập", "Ngày thưởng", "Mức thưởng", "Lý do"]);
      rows.push(
        ...dashboard.bonuses.map((bonus) => [
          bonus.employeeName,
          bonus.employeeCode,
          bonus.createdAt,
          Math.round(Number(bonus.amount || 0)),
          bonus.reason
        ])
      );
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      sendCsv(response, csv);
      return;
    }

    if (pathName.startsWith("/api/")) {
      sendJson(response, 404, { message: "Không tìm thấy API." });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { message: "Máy chủ gặp lỗi. Vui lòng thử lại." });
  }
}

initializeData()
  .then(() => {
    http.createServer(route).listen(PORT, HOST, () => {
      console.log(`Cham Cong Quan dang chay tai http://localhost:${PORT}`);
      console.log(`Nguon du lieu: ${USE_SUPABASE ? "Supabase" : "data.json local"}`);
      console.log(`Admin co the truy cap qua IP may chu, vi du http://<IP-may-chu>:${PORT}`);
      console.log("Khong gioi han WiFi/IP cho nhan vien cham cong.");
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
