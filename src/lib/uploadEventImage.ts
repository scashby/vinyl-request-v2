import { uploadAdminImage } from "src/lib/adminImageLibrary";

type UploadEventImageResult = {
  path: string;
  publicUrl: string;
};

export async function uploadEventImage(file: File): Promise<UploadEventImageResult> {
  const payload = await uploadAdminImage("eventImage", file);
  return {
    path: payload.path,
    publicUrl: payload.publicUrl,
  };
}
