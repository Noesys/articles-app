const MAX_SIZE = 2 * 1024 * 1024;
const COMPRESS_THRESHOLD = 1 * 1024 * 1024;
const MAX_WIDTH = 1024;

/** Compress large images; returns a Blob suitable for multipart upload. */
export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (file.size > MAX_SIZE) throw new Error("Image exceeds 2MB limit");
  if (file.size <= COMPRESS_THRESHOLD) return file;

  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read image"));
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("Invalid image"));
  });
  const scale = Math.min(1, MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), mime, 0.8),
  );
  if (!blob) throw new Error("Failed to compress image");
  if (blob.size > MAX_SIZE) throw new Error("Image exceeds 2MB limit after compression");
  return blob;
}

/** @deprecated Prefer uploadArticleImage — kept for any legacy callers. */
export async function convertImageToBase64(file: File): Promise<string> {
  if (file.size > MAX_SIZE) throw new Error("Image exceeds 2MB limit");
  if (file.size <= COMPRESS_THRESHOLD) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("Failed to read image"));
      r.readAsDataURL(file);
    });
  }
  const blob = await prepareImageForUpload(file);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read image"));
    r.readAsDataURL(blob);
  });
}
