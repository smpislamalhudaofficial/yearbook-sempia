(() => {
  "use strict";
  let token = sessionStorage.getItem("yb_admin_token") || "";
  let profiles = [];
  let activePersonId = "";
  const loginPanel = document.getElementById("loginPanel");
  const dashboardPanel = document.getElementById("dashboardPanel");
  const dialog = document.getElementById("detailDialog");
  const detailBody = document.getElementById("detailBody");
  const detailLoading = document.getElementById("detailLoading");

  function message(id, text, kind = "") {
    const element = document.getElementById(id);
    element.textContent = text;
    element.className = "message " + kind;
  }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  async function loadDashboard() {
    const data = await YearbookAPI.call("adminDashboard", { token });
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
    loginPanel.classList.add("hidden"); dashboardPanel.classList.remove("hidden");
    renderStats(data.stats || {}); renderRows(); message("dashboardMessage", "");
  }
  function renderStats(stats) {
    const items = [
      ["Total peserta", stats.total || 0], ["Sudah mengisi", stats.submitted || 0],
      ["Belum mengisi", stats.notSubmitted || 0], ["Menunggu", stats.pending || 0],
      ["Terverifikasi", stats.verified || 0], ["Perlu revisi", stats.revision || 0]
    ];
    document.getElementById("stats").innerHTML = items.map(([label, value]) =>
      `<div class="stat-card"><small>${escapeHtml(label)}</small><strong>${Number(value) || 0}</strong></div>`
    ).join("");
  }
  function renderRows() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const status = document.getElementById("statusFilter").value;
    const rows = profiles.filter((profile) => {
      const text = `${profile.name || ""} ${profile.personId || ""}`.toLowerCase();
      return text.includes(query) && (category === "all" || profile.category === category) && (status === "all" || profile.status === status);
    });
    document.getElementById("resultCount").textContent = `${rows.length} peserta ditampilkan`;
    const target = document.getElementById("profileRows");
    if (!rows.length) { target.innerHTML = '<tr><td colspan="6" class="empty-cell">Tidak ada peserta yang cocok.</td></tr>'; return; }
    target.innerHTML = rows.map((profile) => {
      const notSubmitted = profile.status === "not_submitted";
      const photoLabel = profile.category === "teacher" ? "—" : (profile.hasPhoto ? "Ada" : "Belum ada");
      return `<tr>
        <td><strong>${escapeHtml(profile.name)}</strong><small class="table-subline">${escapeHtml(profile.personId)}${profile.className ? " · " + escapeHtml(profile.className) : ""}</small></td>
        <td>${profile.category === "student" ? "Siswa" : "Guru"}</td>
        <td><span class="pill ${escapeHtml(profile.status)}">${statusLabel(profile.status)}</span></td>
        <td>${photoLabel}</td><td>${escapeHtml(formatDate(profile.updatedAt))}</td>
        <td><button type="button" class="action" data-action="detail" data-id="${escapeHtml(profile.personId)}" ${notSubmitted ? "disabled title=\"Belum ada data untuk dibuka\"" : ""}>${notSubmitted ? "Belum ada data" : "Lihat detail"}</button></td>
      </tr>`;
    }).join("");
  }
  async function openDetail(personId) {
    activePersonId = personId;
    detailBody.classList.add("hidden"); detailLoading.classList.remove("hidden");
    detailLoading.textContent = "Memuat detail…";
    document.getElementById("detailTitle").textContent = "Memuat profil";
    document.getElementById("detailMessage").textContent = "";
    document.getElementById("adminNote").value = "";
    if (!dialog.open) dialog.showModal();
    try {
      const data = await YearbookAPI.call("adminGetProfile", { token, personId });
      const profile = data.profile;
      document.getElementById("detailTitle").textContent = profile.name || "Detail peserta";
      renderDetailFields(profile);
      const photo = document.getElementById("detailPhoto");
      if (data.photo && data.photo.base64) {
        photo.src = `data:${data.photo.mime || "image/jpeg"};base64,${data.photo.base64}`;
        photo.alt = `Foto ${profile.name || "peserta"}`; photo.classList.remove("hidden");
      } else { photo.removeAttribute("src"); photo.classList.add("hidden"); }
      document.getElementById("adminNote").value = profile.adminNote || "";
      document.getElementById("verifyButton").disabled = profile.status === "verified";
      document.getElementById("revisionButton").disabled = profile.status === "revision";
      detailLoading.classList.add("hidden"); detailBody.classList.remove("hidden");
    } catch (error) { detailLoading.textContent = error.message; }
  }
  function renderDetailFields(profile) {
    const social = Array.isArray(profile.socialAccounts) && profile.socialAccounts.length
      ? profile.socialAccounts.map((item) => `${item.platform}: ${item.handle}`).join("\n") : "—";
    const fields = [
      ["Kategori", profile.category === "student" ? "Siswa" : "Guru"], ["ID peserta", profile.personId], ["Kelas", profile.className || "—"],
      ["Tempat lahir", profile.birthplace], ["Tanggal lahir", formatBirthdate(profile.birthdate)], ["Alamat", profile.address],
      ["WhatsApp", profile.whatsapp], ["Media sosial", social], [profile.category === "student" ? "Quote" : "Kata mutiara", profile.motto],
      ["Status", statusLabel(profile.status)], ["Persetujuan", profile.consent ? `Diberikan (${profile.consentVersion || "versi tidak tercatat"})` : "Belum tercatat"],
      ["Waktu persetujuan", formatDate(profile.consentAt)], ["Dikirim", formatDate(profile.createdAt)]
    ];
    document.getElementById("detailFields").innerHTML = fields.map(([label, value]) =>
      `<div class="detail-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></div>`
    ).join("");
  }
  async function updateStatus(status) {
    if (!activePersonId) return;
    const note = document.getElementById("adminNote").value.trim();
    if (status === "revision" && !note) { message("detailMessage", "Tuliskan bagian yang perlu diperbaiki.", "error"); return; }
    const button = document.getElementById(status === "verified" ? "verifyButton" : "revisionButton");
    button.disabled = true; button.textContent = "Menyimpan…";
    try {
      await YearbookAPI.call("setStatus", { token, personId: activePersonId, status, adminNote: note });
      dialog.close(); await loadDashboard();
      message("dashboardMessage", status === "verified" ? "Data berhasil diverifikasi." : "Permintaan revisi berhasil dikirim.", "success");
    } catch (error) { message("detailMessage", error.message, "error"); }
    finally { button.disabled = false; button.textContent = status === "verified" ? "Verifikasi" : "Minta revisi"; }
  }

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("loginButton");
    const passwordInput = document.getElementById("adminPassword");
    button.disabled = true; button.querySelector("span").textContent = "CHECKING…";
    try {
      const result = await YearbookAPI.call("adminLogin", { password: passwordInput.value });
      token = result.token; sessionStorage.setItem("yb_admin_token", token); passwordInput.value = "";
      await loadDashboard();
    } catch (error) { message("loginMessage", error.message, "error"); }
    finally { button.disabled = false; button.querySelector("span").textContent = "OPEN DASHBOARD"; }
  });
  document.getElementById("logoutButton").addEventListener("click", async () => {
    try { if (token) await YearbookAPI.call("adminLogout", { token }); } catch (_) {}
    sessionStorage.removeItem("yb_admin_token"); token = ""; profiles = [];
    dashboardPanel.classList.add("hidden"); loginPanel.classList.remove("hidden");
    message("loginMessage", "Anda sudah keluar dari dashboard.", "success");
  });
  document.getElementById("profileRows").addEventListener("click", (event) => {
    const button = event.target.closest('button[data-action="detail"]');
    if (button && !button.disabled) openDetail(button.dataset.id);
  });
  ["searchInput", "categoryFilter", "statusFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderRows);
    document.getElementById(id).addEventListener("change", renderRows);
  });
  document.getElementById("refreshButton").addEventListener("click", async () => {
    const button = document.getElementById("refreshButton"); button.disabled = true; button.textContent = "Loading…";
    try { await loadDashboard(); } catch (error) { message("dashboardMessage", error.message, "error"); }
    finally { button.disabled = false; button.textContent = "↻ Refresh"; }
  });
  document.getElementById("verifyButton").addEventListener("click", () => updateStatus("verified"));
  document.getElementById("revisionButton").addEventListener("click", () => updateStatus("revision"));
  document.getElementById("closeDialogButton").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => {
    const photo = document.getElementById("detailPhoto"); photo.removeAttribute("src");
    document.getElementById("detailFields").replaceChildren(); document.getElementById("adminNote").value = ""; activePersonId = "";
  });
  function statusLabel(status) {
    return ({ not_submitted: "Belum mengisi", pending: "Menunggu", verified: "Terverifikasi", revision: "Perlu revisi" })[status] || status || "—";
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function formatBirthdate(value) {
    if (!value) return "—";
    const parts = String(value).split("-");
    if (parts.length !== 3) return String(value);
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
  }

  if (token) {
    loadDashboard().catch((error) => {
      sessionStorage.removeItem("yb_admin_token"); token = "";
      message("loginMessage", error.message || "Sesi admin berakhir. Silakan login kembali.", "error");
    });
  }
})();
