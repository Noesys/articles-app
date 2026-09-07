const MAX_SIZE = 2 * 1024 * 1024;
const COMPRESS_THRESHOLD = 1 * 1024 * 1024;
const MAX_WIDTH = 1024;

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
  // compress via canvas
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Failed to read image"));
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = dataUrl;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error("Invalid image"));
  });
  const scale = Math.min(1, MAX_WIDTH / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type || "image/jpeg", 0.8);
}
