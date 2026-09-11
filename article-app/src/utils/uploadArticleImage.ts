import { api } from "@/http-client";
import { prepareImageForUpload } from "@/utils/imageToBase64";

export type UploadedImage = {
  key: string;
  url: string;
  contentType: string;
  size: number;
};

/**
 * Compress (if needed) and upload an image to R2 via the Worker.
 * Returns a same-origin `/api/images/...` URL for TipTap `<img src>`.
 */
export async function uploadArticleImage(file: File): Promise<string> {
  const blob = await prepareImageForUpload(file);
  const form = new FormData();
  const name = file.name || `image.${blob.type === "image/png" ? "png" : "jpg"}`;
  form.append("file", blob, name);

  const data = await api<UploadedImage>("/images", {
    method: "POST",
    body: form,
  });
  return data.url;
}
