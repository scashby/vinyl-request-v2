export const ADMIN_IMAGE_KINDS = ["eventImage", "venueLogo"] as const;

export type AdminImageKind = (typeof ADMIN_IMAGE_KINDS)[number];
export type AdminImageSourceType = "supabase" | "external";

export type AdminImageUsage = {
  usageType: "event" | "eventType" | "eventSubtype";
  label: string;
  href: string | null;
};

export type AdminImageAsset = {
  imageKind: AdminImageKind;
  sourceType: AdminImageSourceType;
  publicUrl: string;
  storagePath: string | null;
  bucketName: string | null;
  label: string;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  usage: AdminImageUsage[];
  isManaged: boolean;
};
