window.compressPhoto = async function (file, maxBytes = 2 * 1024 * 1024) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Gunakan foto JPG, PNG, atau WebP.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Ukuran foto asli maksimal 15 MB.");
  if (typeof createImageBitmap !== "function") throw new Error("Browser belum mendukung kompresi foto. Gunakan Chrome, Edge, atau Safari terbaru.");

  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch (_) { throw new Error("Foto tidak dapat dibuka. Simpan ulang foto lalu pilih kembali."); }

  let width = bitmap.width;
  let height = bitmap.height;
  const longest = Math.max(width, height);
  if (longest > 2600) {
    const scale = 2600 / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) { bitmap.close?.(); throw new Error("Browser tidak dapat memproses foto."); }

  let quality = 0.9;
  let blob = null;
  for (let attempt = 0; attempt < 18; attempt++) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) break;
    if (quality > 0.48) quality -= 0.06;
    else { width = Math.max(1, Math.round(width * 0.86)); height = Math.max(1, Math.round(height * 0.86)); quality = 0.68; }
  }
  bitmap.close?.();
  if (!blob || blob.size > maxBytes) throw new Error("Foto belum dapat dikompres hingga maksimal 2 MB. Coba foto lain.");
  const baseName = file.name.replace(/\.[^.]+$/, "") || "yearbook";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
};
