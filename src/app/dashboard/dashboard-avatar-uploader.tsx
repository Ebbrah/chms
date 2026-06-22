"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { uploadMyProfilePhoto } from "@/lib/actions/profile-photo";

export function DashboardAvatarUploader({ avatarUrl }: { avatarUrl: string | null }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function onPickClick() {
    fileInputRef.current?.click();
  }

  async function onFilePicked(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMsg(null);

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read image"));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl) {
      setUploading(false);
      setMsg("Could not read selected image");
      return;
    }

    const fd = new FormData();
    fd.set("photo_data_url", dataUrl);
    const res = await uploadMyProfilePhoto(fd);
    setUploading(false);

    if ("error" in res && res.error) {
      setMsg(res.error);
      return;
    }

    setMsg("Profile photo updated");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onPickClick}
        className="rounded-full transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Tap profile photo to update"
        aria-label="Update profile photo"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt="User profile"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full border object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-xs text-muted-foreground">
            Add photo
          </div>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFilePicked(e.target.files?.[0] ?? null)}
      />
      {uploading ? <p className="text-[11px] text-muted-foreground">Uploading...</p> : null}
      {msg ? <p className="text-[11px] text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
