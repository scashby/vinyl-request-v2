import { uploadAdminImage } from "src/lib/adminImageLibrary";

type UploadVenueLogoResult = {
  path: string;
  publicUrl: string;
};

export async function uploadVenueLogo(file: File): Promise<UploadVenueLogoResult> {
  const payload = await uploadAdminImage("venueLogo", file);
  return {
    path: payload.path,
    publicUrl: payload.publicUrl,
  };
}
