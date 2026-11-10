(() => {
  "use strict";
  const choices = document.getElementById("choices");
  const panel = document.getElementById("formPanel");
  const select = document.getElementById("personSelect");
  const form = document.getElementById("profileForm");
  const photoInput = document.getElementById("photo");
  const photoSection = document.getElementById("photoSection");
  const photoPreview = document.getElementById("photoPreview");
  const photoStatus = document.getElementById("photoStatus");
  const socialSection = document.getElementById("socialSection");
  const socialRows = document.getElementById("socialRows");
  let category = "student";
  let compressed = null;
  let previewUrl = "";

  const msg = (text, type = "") => {
    const el = document.getElementById("formMessage");
    el.textContent = text;
    el.className = "message " + type;
  };
  const value = (id) => document.getElementById(id).value.trim();

  function escapeHtml(text) {
    return String(text == null ? "" : text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    photoPreview.replaceChildren();
    photoPreview.classList.add("hidden");
    photoStatus.textContent = "";
    photoStatus.classList.remove("error-text");
  }
  function addSocialRow(platform = "Instagram", handle = "") {
    if (socialRows.children.length >= 5) {
      msg("Maksimal 5 akun media sosial.", "error");
      return;
    }
    const row = document.createElement("div");
    row.className = "social-row";
    const selectEl = document.createElement("select");
    selectEl.setAttribute("aria-label", "Platform media sosial");
    ["Instagram", "TikTok", "YouTube", "Facebook", "X", "Threads", "Lainnya"].forEach((item) => {
      const option = document.createElement("option"); option.value = item; option.textContent = item; selectEl.appendChild(option);
    });
    selectEl.value = platform;
    const input = document.createElement("input");
    input.type = "text"; input.maxLength = 160; input.placeholder = "@username / tautan"; input.setAttribute("aria-label", "Username atau tautan"); input.value = handle;
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "remove-social"; remove.textContent = "×"; remove.setAttribute("aria-label", "Hapus akun sosial media");
    remove.addEventListener("click", () => row.remove());
    row.append(selectEl, input, remove);
    socialRows.appendChild(row);
  }
  function collectSocialAccounts() {
    return [...socialRows.querySelectorAll(".social-row")].map((row) => ({
      platform: row.querySelector("select").value,
      handle: row.querySelector("input").value.trim()
    })).filter((item) => item.handle);
  }
  function resetSocialRows() { socialRows.replaceChildren(); addSocialRow(); }
  function updateProgress() {
    const required = [...form.querySelectorAll("input[required],select[required],textarea[required]")].filter((el) => el.type !== "checkbox");
    const done = required.filter((el) => el.type === "file" ? !!compressed : !!String(el.value || "").trim()).length;
    const consent = document.getElementById("consent").checked ? 1 : 0;
    const total = required.length + 1;
    document.getElementById("formProgress").style.width = Math.round(((done + consent) / total) * 100) + "%";
  }

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", async () => {
      category = button.dataset.category;
      choices.classList.add("hidden"); panel.classList.remove("hidden");
      const student = category === "student";
      document.getElementById("formTitle").textContent = student ? "Tell us about you." : "A little about you.";
      document.getElementById("formEyebrow").textContent = student ? "STUDENT FORM" : "TEACHER FORM";
      document.getElementById("mottoLabel").textContent = student ? "Quote / kata-kata hari ini" : "Kata mutiara";
      socialSection.classList.toggle("hidden", !student);
      photoSection.classList.toggle("hidden", !student);
      photoInput.required = student;
      select.innerHTML = '<option value="">Memuat daftar nama…</option>';
      msg("");
      try {
        const data = await YearbookAPI.call("getRoster", { category });
        select.innerHTML = '<option value="">Pilih nama…</option>' + data.map((person) => {
          const label = `${escapeHtml(person.name)}${person.className ? " — " + escapeHtml(person.className) : ""}`;
          return `<option value="${escapeHtml(person.id)}" data-requires-code="${person.requiresCode ? "true" : "false"}">${label}</option>`;
        }).join("");
        if (!data.length) select.innerHTML = '<option value="">Daftar nama belum tersedia</option>';
      } catch (error) {
        select.innerHTML = '<option value="">Daftar nama tidak dapat dimuat</option>';
        msg(error.message, "error");
      }
      resetSocialRows();
      updateProgress();
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.getElementById("backButton").addEventListener("click", () => {
    panel.classList.add("hidden"); choices.classList.remove("hidden"); form.reset(); compressed = null; clearPreview(); resetSocialRows();
    document.getElementById("accessCodeField").classList.add("hidden"); document.getElementById("accessCode").required = false;
    msg(""); updateProgress();
  });
  document.getElementById("addSocialButton").addEventListener("click", () => addSocialRow());
  select.addEventListener("change", () => {
    const selected = select.selectedOptions && select.selectedOptions[0];
    const requiredCode = !!(selected && selected.dataset.requiresCode === "true");
    const codeField = document.getElementById("accessCodeField");
    const codeInput = document.getElementById("accessCode");
    codeField.classList.toggle("hidden", !requiredCode);
    codeInput.required = requiredCode;
    if (!requiredCode) codeInput.value = "";
    updateProgress();
  });

  photoInput.addEventListener("change", async (event) => {
    const file = event.target.files && event.target.files[0];
    compressed = null; clearPreview(); updateProgress();
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      photoStatus.textContent = "Ukuran foto asli maksimal 15 MB."; photoStatus.classList.add("error-text"); photoInput.value = ""; return;
    }
    photoStatus.classList.remove("error-text"); photoStatus.textContent = "Compressing your photo…";
    try {
      compressed = await compressPhoto(file);
      previewUrl = URL.createObjectURL(compressed);
      const image = document.createElement("img"); image.src = previewUrl; image.alt = "Pratinjau foto yang akan dikirim";
      photoPreview.replaceChildren(image); photoPreview.classList.remove("hidden");
      photoStatus.textContent = `Ready to upload · ${(compressed.size / 1024).toFixed(0)} KB · JPEG`;
    } catch (error) {
      compressed = null; photoStatus.textContent = error.message; photoStatus.classList.add("error-text"); photoInput.value = "";
    }
    updateProgress();
  });

  form.addEventListener("input", updateProgress);
  form.addEventListener("change", updateProgress);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (category === "student" && !compressed) { msg("Pilih foto terlebih dahulu.", "error"); return; }
    if (!select.value) { msg("Pilih nama dari daftar resmi sekolah.", "error"); return; }
    if (!document.getElementById("consent").checked) { msg("Persetujuan pengiriman data wajib dicentang.", "error"); return; }

    const button = document.getElementById("submitButton");
    button.disabled = true; button.querySelector("span").textContent = "SENDING…";
    try {
      const photoBase64 = compressed ? await fileToBase64(compressed) : "";
      const result = await YearbookAPI.call("submitProfile", {
        category, personId: select.value, accessCode: value("accessCode"),
        birthplace: value("birthplace"), birthdate: value("birthdate"), address: value("address"), whatsapp: value("whatsapp"),
        socialAccounts: category === "student" ? collectSocialAccounts() : [],
        motto: value("motto"), photoMime: photoBase64 ? "image/jpeg" : "", photoBase64,
        consent: true, consentVersion: "2026-11-02"
      });
      form.reset(); compressed = null; clearPreview(); resetSocialRows();
      document.getElementById("accessCodeField").classList.add("hidden");
      document.getElementById("accessCode").required = false;
      updateProgress();
      msg(result.updated ? "Perbaikan berhasil dikirim. Data kembali menunggu verifikasi admin." : "Data berhasil dikirim. Thank you! ✨", "success");
    } catch (error) { msg(error.message, "error"); }
    finally { button.disabled = false; button.querySelector("span").textContent = "SUBMIT MY STORY"; }
  });

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("Foto gagal dibaca. Silakan pilih ulang."));
      reader.readAsDataURL(file);
    });
  }
  resetSocialRows();
  const today = new Date();
  const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById("birthdate").max = localToday;
  updateProgress();
})();
