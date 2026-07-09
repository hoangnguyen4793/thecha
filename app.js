const WIFI_NAME = "The -Cha";
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });

let session = null;
let employeeDashboard = null;
let adminDashboard = null;
let wifiStatus = { allowed: true, ip: "-", networkName: WIFI_NAME, requireWifi: false };
let detailDateFrom = "";
let detailDateTo = "";
let adminPayrollMonth = toMonthInput(new Date());
const adminPanelState = {
  employeeForm: false,
  adminPasswordForm: false,
  bonusForm: false,
  penaltyForm: false
};

const els = {
  employeeLoginForm: document.getElementById("employeeLoginForm"),
  employeeCode: document.getElementById("employeeCode"),
  employeePin: document.getElementById("employeePin"),
  employeeLoginError: document.getElementById("employeeLoginError"),
  employeeProfile: document.getElementById("employeeProfile"),
  employeeLogout: document.getElementById("employeeLogout"),
  employeePasswordForm: document.getElementById("employeePasswordForm"),
  employeeCurrentPin: document.getElementById("employeeCurrentPin"),
  employeeNewPin: document.getElementById("employeeNewPin"),
  employeeConfirmPin: document.getElementById("employeeConfirmPin"),
  employeePasswordStatus: document.getElementById("employeePasswordStatus"),
  wifiBox: document.getElementById("wifiBox"),
  wifiText: document.getElementById("wifiText"),
  wifiHelp: document.getElementById("wifiHelp"),
  employeeRole: document.getElementById("employeeRole"),
  employeeName: document.getElementById("employeeName"),
  employeePayRate: document.getElementById("employeePayRate"),
  checkInBtn: document.getElementById("checkInBtn"),
  checkOutBtn: document.getElementById("checkOutBtn"),
  employeeNotice: document.getElementById("employeeNotice"),
  expectedPay: document.getElementById("expectedPay"),
  totalHours: document.getElementById("totalHours"),
  shiftCount: document.getElementById("shiftCount"),
  shiftStatus: document.getElementById("shiftStatus"),
  employeeRows: document.getElementById("employeeRows"),
  employeeMonthLabel: document.getElementById("employeeMonthLabel"),
  todayCheckins: document.getElementById("todayCheckins"),
  activeShifts: document.getElementById("activeShifts"),
  payrollTotal: document.getElementById("payrollTotal"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  adminCode: document.getElementById("adminCode"),
  adminPin: document.getElementById("adminPin"),
  adminLoginError: document.getElementById("adminLoginError"),
  adminQuickActions: document.getElementById("adminQuickActions"),
  adminPasswordForm: document.getElementById("adminPasswordForm"),
  adminCurrentPin: document.getElementById("adminCurrentPin"),
  adminNewPin: document.getElementById("adminNewPin"),
  adminConfirmPin: document.getElementById("adminConfirmPin"),
  adminPasswordStatus: document.getElementById("adminPasswordStatus"),
  employeeForm: document.getElementById("employeeForm"),
  bonusForm: document.getElementById("bonusForm"),
  bonusEmployee: document.getElementById("bonusEmployee"),
  bonusAmount: document.getElementById("bonusAmount"),
  bonusReason: document.getElementById("bonusReason"),
  bonusStatus: document.getElementById("bonusStatus"),
  bonusRows: document.getElementById("bonusRows"),
  bonusCount: document.getElementById("bonusCount"),
  penaltyForm: document.getElementById("penaltyForm"),
  penaltyEmployee: document.getElementById("penaltyEmployee"),
  penaltyAmount: document.getElementById("penaltyAmount"),
  penaltyReason: document.getElementById("penaltyReason"),
  penaltyStatus: document.getElementById("penaltyStatus"),
  penaltyRows: document.getElementById("penaltyRows"),
  penaltyCount: document.getElementById("penaltyCount"),
  detailDateFrom: document.getElementById("detailDateFrom"),
  detailDateTo: document.getElementById("detailDateTo"),
  clearDetailFilter: document.getElementById("clearDetailFilter"),
  adminPayrollMonth: document.getElementById("adminPayrollMonth"),
  adminRows: document.getElementById("adminRows"),
  adminDetailRows: document.getElementById("adminDetailRows"),
  adminDetailCount: document.getElementById("adminDetailCount"),
  adminCount: document.getElementById("adminCount"),
  adminNotice: document.getElementById("adminNotice"),
  adminLogout: document.getElementById("adminLogout"),
  exportCsv: document.getElementById("exportCsv"),
  clockDate: document.getElementById("clockDate"),
  clockTime: document.getElementById("clockTime")
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "same-origin",
      ...options
    });
  } catch {
    throw new Error(serverConnectionMessage());
  }
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(payload?.message || "Yêu cầu chưa thực hiện được.");
  return payload;
}

function serverConnectionMessage() {
  if (location.protocol === "file:") {
    return "Bạn đang mở trang bằng file trực tiếp nên không đăng nhập được. Hãy chạy node server.js rồi mở http://localhost:3000.";
  }
  return "Không kết nối được máy chủ. Hãy kiểm tra server đã chạy bằng lệnh node server.js và mở đúng địa chỉ http://localhost:3000.";
}

function formatMoney(value) {
  return currency.format(Math.round(value));
}

function formatDateTime(value, mode) {
  if (!value) return "-";
  const date = new Date(value);
  if (mode === "date") return date.toLocaleDateString("vi-VN");
  return timeFormat.format(date);
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function toMonthInput(value) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 7);
}

function showLoginError(target, message) {
  target.textContent = message;
  target.classList.remove("is-hidden");
}

function clearLoginError(target) {
  target.textContent = "";
  target.classList.add("is-hidden");
}

function showFormStatus(target, message, type = "error") {
  target.textContent = message;
  target.classList.toggle("is-success", type === "success");
  target.classList.remove("is-hidden");
}

function clearFormStatus(target) {
  target.textContent = "";
  target.classList.remove("is-success");
  target.classList.add("is-hidden");
}

function renderClock() {
  const now = new Date();
  els.clockDate.textContent = dateFormat.format(now);
  els.clockTime.textContent = timeFormat.format(now);
}

function renderWifi() {
  if (!els.wifiBox) return;
  els.wifiBox.classList.add("is-hidden");
}

function renderEmployee() {
  if (!els.employeeLoginForm) return;
  const isEmployee = session?.role === "employee" && employeeDashboard;
  els.employeeLoginForm.classList.toggle("is-hidden", isEmployee);
  els.employeeProfile.classList.toggle("is-hidden", !isEmployee);
  els.employeePasswordForm.classList.toggle("is-hidden", !isEmployee);

  if (!isEmployee) {
    els.employeeName.textContent = "-";
    els.expectedPay.textContent = "0 đ";
    els.totalHours.textContent = "0h";
    els.shiftCount.textContent = "0";
    els.shiftStatus.textContent = "Chưa đăng nhập";
    els.employeeRows.innerHTML = `<tr><td class="empty-row" colspan="5">Đăng nhập để xem lịch sử chấm công của bạn</td></tr>`;
    els.checkInBtn.disabled = true;
    els.checkOutBtn.disabled = true;
    els.employeeNotice.textContent = "Hãy đăng nhập tài khoản của bạn trước khi chấm công.";
    return;
  }

  const { employee, shifts, totals, openShift } = employeeDashboard;
  els.employeeRole.textContent = employee.type === "monthly" ? "Toàn thời gian" : "Bán thời gian";
  els.employeeName.textContent = `${employee.name} (${employee.code})`;
  els.employeePayRate.textContent = employee.type === "monthly"
    ? `${formatMoney(employee.rate)} / tháng cố định`
    : `${formatMoney(employee.rate)} / giờ`;
  els.expectedPay.textContent = formatMoney(totals.pay);
  els.totalHours.textContent = `${totals.hours.toFixed(1)}h`;
  els.shiftCount.textContent = shifts.length;
  els.shiftStatus.textContent = openShift ? "Đang trong ca" : "Chưa vào ca";
  els.checkInBtn.disabled = Boolean(openShift);
  els.checkOutBtn.disabled = !openShift;
  els.employeeNotice.textContent = "Bạn chỉ chấm công cho chính tài khoản đang đăng nhập.";
  els.employeeRows.innerHTML = shifts.length
    ? shifts.map((shift) => renderEmployeeShiftRow(shift, employee)).join("")
    : `<tr><td class="empty-row" colspan="5">Chưa có dữ liệu chấm công trong tháng này</td></tr>`;
}

function renderEmployeeShiftRow(shift, employee) {
  const pay = employee.type === "monthly" ? "Lương tháng cố định" : formatMoney(shift.pay);
  return `
    <tr>
      <td>${formatDateTime(shift.checkIn, "date")}</td>
      <td>${formatDateTime(shift.checkIn, "time")}</td>
      <td>${formatDateTime(shift.checkOut, "time")}</td>
      <td>${shift.checkOut ? `${shift.hours.toFixed(2)}h` : "Đang làm"}</td>
      <td>${pay}</td>
    </tr>
  `;
}

function setPanelToggleLabel(panelName, visibleLabel, hiddenLabel) {
  const button = els.adminQuickActions?.querySelector(`[data-toggle-panel="${panelName}"]`);
  if (button) button.textContent = adminPanelState[panelName] ? visibleLabel : hiddenLabel;
}

function renderAdmin() {
  if (!els.adminLoginForm) return;
  const isAdmin = session?.role === "admin" && adminDashboard;
  if (!isAdmin) {
    Object.keys(adminPanelState).forEach((key) => {
      adminPanelState[key] = false;
    });
  }
  els.adminLoginForm.classList.toggle("is-hidden", isAdmin);
  els.adminQuickActions.classList.toggle("is-hidden", !isAdmin);
  els.employeeForm.classList.toggle("is-hidden", !isAdmin || !adminPanelState.employeeForm);
  els.adminPasswordForm.classList.toggle("is-hidden", !isAdmin || !adminPanelState.adminPasswordForm);
  if (els.bonusForm) els.bonusForm.classList.toggle("is-hidden", !isAdmin || !adminPanelState.bonusForm);
  els.penaltyForm.classList.toggle("is-hidden", !isAdmin || !adminPanelState.penaltyForm);
  els.exportCsv.classList.toggle("is-hidden", !isAdmin);
  els.adminLogout.classList.toggle("is-hidden", !isAdmin);
  setPanelToggleLabel("employeeForm", "Ẩn thêm nhân viên", "Thêm nhân viên");
  setPanelToggleLabel("adminPasswordForm", "Ẩn đổi mật khẩu", "Đổi mật khẩu");
  setPanelToggleLabel("bonusForm", "Ẩn thưởng nhân viên", "Thưởng nhân viên");
  setPanelToggleLabel("penaltyForm", "Ẩn phạt nhân viên", "Phạt nhân viên");

  if (!isAdmin) {
    els.adminCount.textContent = "0 nhân viên";
    els.adminRows.innerHTML = `<tr><td class="empty-row" colspan="10">Đăng nhập quản trị để xem bảng lương</td></tr>`;
    els.adminDetailCount.textContent = "0 ca";
    els.adminDetailRows.innerHTML = `<tr><td class="empty-row" colspan="9">Đăng nhập quản trị để xem chi tiết chấm công</td></tr>`;
    if (els.bonusCount) els.bonusCount.textContent = "0 phiếu thưởng";
    if (els.bonusRows) els.bonusRows.innerHTML = `<tr><td class="empty-row" colspan="6">Đăng nhập quản trị để xem danh sách thưởng</td></tr>`;
    els.penaltyCount.textContent = "0 phiếu phạt";
    els.penaltyRows.innerHTML = `<tr><td class="empty-row" colspan="6">Đăng nhập quản trị để xem danh sách phạt</td></tr>`;
    els.adminNotice.textContent = "Chỉ quản trị viên đã đăng nhập mới xem và sửa được bảng lương.";
    return;
  }

  const shiftDetails = filterShiftDetails(adminDashboard.shiftDetails || []);
  const bonuses = adminDashboard.bonuses || [];
  const penalties = adminDashboard.penalties || [];
  const totals = adminDashboard.totals || { hours: 0, grossPay: 0, bonusTotal: 0, penaltyTotal: 0, pay: 0 };
  els.adminPayrollMonth.value = adminDashboard.month || adminPayrollMonth;
  els.adminCount.textContent = `${adminDashboard.employees.length} nhân viên`;
  els.adminDetailCount.textContent = `${shiftDetails.length} ca`;
  if (els.bonusCount) els.bonusCount.textContent = `${bonuses.length} phiếu thưởng`;
  els.penaltyCount.textContent = `${penalties.length} phiếu phạt`;
  els.adminNotice.textContent = "Quản trị viên có thể truy cập ở bất kỳ đâu, thêm nhân viên, sửa mức lương và xuất báo cáo.";
  els.exportCsv.href = `/api/report.xlsx?month=${encodeURIComponent(adminPayrollMonth)}`;
  els.penaltyEmployee.innerHTML = adminDashboard.employees
    .map((employee) => `<option value="${employee.id}">${employee.name} (${employee.code})</option>`)
    .join("");
  if (els.bonusEmployee) {
    els.bonusEmployee.innerHTML = adminDashboard.employees
      .map((employee) => `<option value="${employee.id}">${employee.name} (${employee.code})</option>`)
      .join("");
  }
  els.adminRows.innerHTML = `${adminDashboard.employees.map((employee) => `
    <tr>
      <td><strong>${employee.name}</strong></td>
      <td>${employee.code}</td>
      <td>
        <select data-admin-type="${employee.id}">
          <option value="hourly" ${employee.type === "hourly" ? "selected" : ""}>Theo giờ</option>
          <option value="monthly" ${employee.type === "monthly" ? "selected" : ""}>Toàn thời gian</option>
        </select>
      </td>
      <td>
        <input data-admin-rate="${employee.id}" type="number" min="0" step="1000" value="${employee.rate}" />
        ${employee.type === "monthly" ? "<small>Lương tháng cố định</small>" : ""}
      </td>
      <td>${employee.type === "monthly" ? `${employee.hours.toFixed(1)}h tượng trưng` : `${employee.hours.toFixed(1)}h`}</td>
      <td><strong>${formatMoney(employee.grossPay)}</strong></td>
      <td>${formatMoney(employee.bonusTotal)}</td>
      <td>${formatMoney(employee.penaltyTotal)}</td>
      <td><strong>${formatMoney(employee.pay)}</strong></td>
      <td><button class="button button--secondary" data-delete="${employee.id}" type="button">Xóa</button></td>
    </tr>
  `).join("")}
    <tr class="total-row">
      <td colspan="4"><strong>Tổng lương toàn bộ</strong></td>
      <td>${totals.hours.toFixed(1)}h</td>
      <td><strong>${formatMoney(totals.grossPay)}</strong></td>
      <td>${formatMoney(totals.bonusTotal)}</td>
      <td>${formatMoney(totals.penaltyTotal)}</td>
      <td><strong>${formatMoney(totals.pay)}</strong></td>
      <td></td>
    </tr>
  `;
  els.adminDetailRows.innerHTML = shiftDetails.length
    ? shiftDetails.map(renderAdminDetailRow).join("")
    : `<tr><td class="empty-row" colspan="9">Chưa có dữ liệu chấm công trong tháng này</td></tr>`;
  if (els.bonusRows) {
    els.bonusRows.innerHTML = bonuses.length
      ? bonuses.map(renderBonusRow).join("")
      : `<tr><td class="empty-row" colspan="6">Chưa có phiếu thưởng trong tháng này</td></tr>`;
  }
  els.penaltyRows.innerHTML = penalties.length
    ? penalties.map(renderPenaltyRow).join("")
    : `<tr><td class="empty-row" colspan="6">Chưa có phiếu phạt trong tháng này</td></tr>`;
}

function filterShiftDetails(shifts) {
  return shifts.filter((shift) => {
    const day = toDateInput(shift.checkIn);
    if (detailDateFrom && day < detailDateFrom) return false;
    if (detailDateTo && day > detailDateTo) return false;
    return true;
  });
}

function renderAdminDetailRow(shift) {
  return `
    <tr data-shift-row="${shift.id}">
      <td><strong>${shift.employeeName}</strong></td>
      <td>${shift.employeeCode}</td>
      <td>${formatDateTime(shift.checkIn, "date")}</td>
      <td data-shift-check-in-cell data-value="${toDatetimeLocal(shift.checkIn)}">${formatDateTime(shift.checkIn, "time")}</td>
      <td data-shift-check-out-cell data-value="${toDatetimeLocal(shift.checkOut)}">${formatDateTime(shift.checkOut, "time")}</td>
      <td>${shift.checkOut ? `${shift.hours.toFixed(2)}h` : "Đang làm"}</td>
      <td>${shift.type === "monthly" ? "Toàn thời gian" : "Theo giờ"}</td>
      <td>${shift.type === "monthly" ? "Lương tháng cố định" : formatMoney(shift.pay)}</td>
      <td>
        <button class="button button--secondary table-action" data-edit-shift="${shift.id}" type="button">Sửa</button>
        <button class="button button--dark table-action is-hidden" data-save-shift="${shift.id}" type="button">Lưu</button>
        <button class="button button--danger table-action" data-delete-shift="${shift.id}" type="button">Xóa</button>
      </td>
    </tr>
  `;
}

function renderPenaltyRow(penalty) {
  return `
    <tr>
      <td><strong>${penalty.employeeName}</strong></td>
      <td>${penalty.employeeCode}</td>
      <td>${formatDateTime(penalty.createdAt, "date")}</td>
      <td>${formatMoney(penalty.amount)}</td>
      <td>${penalty.reason}</td>
      <td><button class="button button--secondary" data-delete-penalty="${penalty.id}" type="button">Xóa</button></td>
    </tr>
  `;
}

function renderBonusRow(bonus) {
  return `
    <tr>
      <td><strong>${bonus.employeeName}</strong></td>
      <td>${bonus.employeeCode}</td>
      <td>${formatDateTime(bonus.createdAt, "date")}</td>
      <td>${formatMoney(bonus.amount)}</td>
      <td>${bonus.reason}</td>
      <td><button class="button button--secondary" data-delete-bonus="${bonus.id}" type="button">Xóa</button></td>
    </tr>
  `;
}

function renderMetrics() {
  if (!els.todayCheckins) return;
  const metrics = adminDashboard?.metrics || employeeDashboard?.metrics;
  els.todayCheckins.textContent = metrics?.todayCheckins ?? 0;
  els.activeShifts.textContent = metrics?.activeShifts ?? 0;
  els.payrollTotal.textContent = formatMoney(metrics?.payrollTotal ?? 0);
}

function renderAll() {
  renderWifi();
  renderEmployee();
  renderAdmin();
  renderMetrics();
}

async function refresh() {
  const data = await api("/api/session");
  session = data.session;
  wifiStatus = data.wifi;
  employeeDashboard = null;
  adminDashboard = null;

  if (session?.role === "employee") employeeDashboard = await api("/api/employee-dashboard");
  if (session?.role === "admin") adminDashboard = await api(`/api/admin-dashboard?month=${encodeURIComponent(adminPayrollMonth)}`);
  renderAll();
}

async function login(role, code, pin) {
  await api("/api/login", { method: "POST", body: JSON.stringify({ role, code, pin }) });
  await refresh();
}

async function logout() {
  await api("/api/logout", { method: "POST", body: "{}" });
  await refresh();
}

async function changePassword(currentPin, newPin) {
  return api("/api/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPin, newPin })
  });
}

els.employeeLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginError(els.employeeLoginError);
  try {
    await login("employee", els.employeeCode.value.trim(), els.employeePin.value.trim());
    els.employeeLoginForm.reset();
    clearLoginError(els.employeeLoginError);
  } catch (error) {
    showLoginError(els.employeeLoginError, "Tên đăng nhập hoặc mã PIN không đúng. Vui lòng kiểm tra lại.");
    els.employeeNotice.textContent = "Không thể đăng nhập nhân viên.";
  }
});

els.adminLoginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearLoginError(els.adminLoginError);
  try {
    await login("admin", els.adminCode.value.trim(), els.adminPin.value.trim());
    els.adminLoginForm.reset();
    clearLoginError(els.adminLoginError);
  } catch (error) {
    showLoginError(els.adminLoginError, "Tên đăng nhập hoặc mật khẩu không đúng. Vui lòng kiểm tra lại.");
    els.adminNotice.textContent = "Không thể đăng nhập quản trị.";
  }
});

els.employeeCode?.addEventListener("input", () => clearLoginError(els.employeeLoginError));
els.employeePin?.addEventListener("input", () => clearLoginError(els.employeeLoginError));
els.adminCode?.addEventListener("input", () => clearLoginError(els.adminLoginError));
els.adminPin?.addEventListener("input", () => clearLoginError(els.adminLoginError));

els.adminQuickActions?.addEventListener("click", (event) => {
  const panel = event.target.dataset.togglePanel;
  if (!panel || !(panel in adminPanelState)) return;
  adminPanelState[panel] = !adminPanelState[panel];
  renderAdmin();
});

els.adminPayrollMonth?.addEventListener("change", async (event) => {
  adminPayrollMonth = event.target.value || toMonthInput(new Date());
  try {
    await refresh();
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.employeePasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormStatus(els.employeePasswordStatus);
  const currentPin = els.employeeCurrentPin.value.trim();
  const newPin = els.employeeNewPin.value.trim();
  const confirmPin = els.employeeConfirmPin.value.trim();
  if (newPin !== confirmPin) {
    showFormStatus(els.employeePasswordStatus, "Mã PIN mới nhập lại chưa khớp.");
    return;
  }
  try {
    const result = await changePassword(currentPin, newPin);
    els.employeePasswordForm.reset();
    showFormStatus(els.employeePasswordStatus, result.message || "Đã đổi mã PIN.", "success");
  } catch (error) {
    showFormStatus(els.employeePasswordStatus, error.message);
  }
});

els.adminPasswordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormStatus(els.adminPasswordStatus);
  const currentPin = els.adminCurrentPin.value.trim();
  const newPin = els.adminNewPin.value.trim();
  const confirmPin = els.adminConfirmPin.value.trim();
  if (newPin !== confirmPin) {
    showFormStatus(els.adminPasswordStatus, "Mật khẩu mới nhập lại chưa khớp.");
    return;
  }
  try {
    const result = await changePassword(currentPin, newPin);
    els.adminPasswordForm.reset();
    showFormStatus(els.adminPasswordStatus, result.message || "Đã đổi mật khẩu.", "success");
  } catch (error) {
    showFormStatus(els.adminPasswordStatus, error.message);
  }
});

els.employeeLogout?.addEventListener("click", logout);
els.adminLogout?.addEventListener("click", logout);

els.checkInBtn?.addEventListener("click", async () => {
  try {
    await api("/api/check-in", { method: "POST", body: "{}" });
    await refresh();
  } catch (error) {
    els.employeeNotice.textContent = error.message;
  }
});

els.checkOutBtn?.addEventListener("click", async () => {
  try {
    await api("/api/check-out", { method: "POST", body: "{}" });
    await refresh();
  } catch (error) {
    els.employeeNotice.textContent = error.message;
  }
});

els.employeeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById("newName").value.trim(),
    code: document.getElementById("newCode").value.trim(),
    pin: document.getElementById("newPin").value.trim(),
    type: document.getElementById("newType").value,
    rate: Number(document.getElementById("newRate").value)
  };
  try {
    await api("/api/employees", { method: "POST", body: JSON.stringify(payload) });
    els.employeeForm.reset();
    await refresh();
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.penaltyForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormStatus(els.penaltyStatus);
  const selectedEmployee = els.penaltyEmployee.selectedOptions[0]?.textContent || "nhân viên này";
  const payload = {
    employeeId: els.penaltyEmployee.value,
    amount: Number(els.penaltyAmount.value),
    reason: els.penaltyReason.value.trim()
  };
  if (!payload.employeeId || !payload.amount || payload.amount <= 0 || !payload.reason) {
    showFormStatus(els.penaltyStatus, "Vui lòng chọn nhân viên, nhập mức phạt và lý do phạt.");
    return;
  }
  const confirmed = window.confirm(`Bạn có chắc chắn muốn phạt ${selectedEmployee} số tiền ${formatMoney(payload.amount)} không?`);
  if (!confirmed) {
    showFormStatus(els.penaltyStatus, "Đã hủy thêm phiếu phạt.");
    return;
  }
  try {
    await api("/api/penalties", { method: "POST", body: JSON.stringify(payload) });
    els.penaltyForm.reset();
    await refresh();
    showFormStatus(els.penaltyStatus, `Đã thêm phạt thành công cho ${selectedEmployee}.`, "success");
    els.adminNotice.textContent = "Đã thêm phạt và cập nhật lại bảng lương.";
  } catch (error) {
    showFormStatus(els.penaltyStatus, error.message);
  }
});

els.bonusForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFormStatus(els.bonusStatus);
  const selectedEmployee = els.bonusEmployee.selectedOptions[0]?.textContent || "nhân viên này";
  const payload = {
    employeeId: els.bonusEmployee.value,
    amount: Number(els.bonusAmount.value),
    reason: els.bonusReason.value.trim()
  };
  if (!payload.employeeId || !payload.amount || payload.amount <= 0 || !payload.reason) {
    showFormStatus(els.bonusStatus, "Vui lòng chọn nhân viên, nhập mức thưởng và lý do thưởng.");
    return;
  }
  const confirmed = window.confirm(`Bạn có chắc chắn muốn thưởng ${selectedEmployee} số tiền ${formatMoney(payload.amount)} không?`);
  if (!confirmed) {
    showFormStatus(els.bonusStatus, "Đã hủy thêm phiếu thưởng.");
    return;
  }
  try {
    await api("/api/bonuses", { method: "POST", body: JSON.stringify(payload) });
    els.bonusForm.reset();
    await refresh();
    showFormStatus(els.bonusStatus, `Đã thêm thưởng thành công cho ${selectedEmployee}.`, "success");
    els.adminNotice.textContent = "Đã thêm thưởng và cập nhật lại bảng lương.";
  } catch (error) {
    showFormStatus(els.bonusStatus, error.message);
  }
});

els.adminRows?.addEventListener("change", async (event) => {
  const typeId = event.target.dataset.adminType;
  const rateId = event.target.dataset.adminRate;
  const id = typeId || rateId;
  if (!id) return;
  const payload = typeId ? { type: event.target.value } : { rate: Number(event.target.value) || 0 };
  try {
    await api(`/api/employees/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    await refresh();
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.adminRows?.addEventListener("click", async (event) => {
  const id = event.target.dataset.delete;
  if (!id) return;
  try {
    await api(`/api/employees/${id}`, { method: "DELETE", body: "{}" });
    await refresh();
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.adminDetailRows?.addEventListener("click", async (event) => {
  const row = event.target.closest("[data-shift-row]");
  const editId = event.target.dataset.editShift;
  if (editId && row) {
    const checkInCell = row.querySelector("[data-shift-check-in-cell]");
    const checkOutCell = row.querySelector("[data-shift-check-out-cell]");
    checkInCell.innerHTML = `<input data-shift-check-in type="datetime-local" value="${checkInCell.dataset.value || ""}" />`;
    checkOutCell.innerHTML = `<input data-shift-check-out type="datetime-local" value="${checkOutCell.dataset.value || ""}" />`;
    event.target.classList.add("is-hidden");
    row.querySelector("[data-save-shift]")?.classList.add("is-hidden");
    row.classList.add("is-editing");
    els.adminNotice.textContent = "Đang sửa giờ vào/giờ ra. Khi thay đổi dữ liệu, nút Lưu sẽ xuất hiện.";
    return;
  }

  const deleteId = event.target.dataset.deleteShift;
  if (deleteId && row) {
    const employeeName = row.querySelector("td strong")?.textContent || "nhân viên này";
    const shiftDate = row.children[2]?.textContent || "ngày chấm công này";
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa ca chấm công của ${employeeName} ngày ${shiftDate} không?`);
    if (!confirmed) {
      els.adminNotice.textContent = "Đã hủy xóa ca chấm công.";
      return;
    }
    try {
      await api(`/api/shifts/${deleteId}`, { method: "DELETE", body: "{}" });
      await refresh();
      els.adminNotice.textContent = "Đã xóa ca chấm công và tính lại bảng lương.";
    } catch (error) {
      els.adminNotice.textContent = error.message;
    }
    return;
  }

  const id = event.target.dataset.saveShift;
  if (!id || !row) return;
  const checkIn = row.querySelector("[data-shift-check-in]")?.value;
  const checkOut = row.querySelector("[data-shift-check-out]")?.value;
  const payload = { checkIn, checkOut: checkOut || null };
  try {
    await api(`/api/shifts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    await refresh();
    els.adminNotice.textContent = "Đã lưu thành công giờ vào/giờ ra và tính lại bảng lương.";
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.adminDetailRows?.addEventListener("input", (event) => {
  const row = event.target.closest("[data-shift-row]");
  if (!row || !event.target.matches("[data-shift-check-in], [data-shift-check-out]")) return;
  row.querySelector("[data-save-shift]")?.classList.remove("is-hidden");
});

els.penaltyRows?.addEventListener("click", async (event) => {
  const id = event.target.dataset.deletePenalty;
  if (!id) return;
  try {
    await api(`/api/penalties/${id}`, { method: "DELETE", body: "{}" });
    await refresh();
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.bonusRows?.addEventListener("click", async (event) => {
  const id = event.target.dataset.deleteBonus;
  if (!id) return;
  try {
    await api(`/api/bonuses/${id}`, { method: "DELETE", body: "{}" });
    await refresh();
    els.adminNotice.textContent = "Đã xóa phiếu thưởng và cập nhật lại bảng lương.";
  } catch (error) {
    els.adminNotice.textContent = error.message;
  }
});

els.detailDateFrom?.addEventListener("change", (event) => {
  detailDateFrom = event.target.value;
  renderAdmin();
});

els.detailDateTo?.addEventListener("change", (event) => {
  detailDateTo = event.target.value;
  renderAdmin();
});

els.clearDetailFilter?.addEventListener("click", () => {
  detailDateFrom = "";
  detailDateTo = "";
  els.detailDateFrom.value = "";
  els.detailDateTo.value = "";
  renderAdmin();
});

renderClock();
setInterval(renderClock, 1000);
refresh().catch(() => {
  const message = serverConnectionMessage();
  if (els.employeeNotice) els.employeeNotice.textContent = message;
  if (els.adminNotice) els.adminNotice.textContent = message;
  renderAll();
});

