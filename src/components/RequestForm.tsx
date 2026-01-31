// src/components/RequestForm.tsx
"use client";

import { useState } from "react";
import { addOrVoteRequest } from "src/lib/addOrVoteRequest";

interface RequestFormProps {
  eventId: string;
}
interface FormData {
  artist: string;
  title: string;
  side: string;
  name: string;
  comment?: string;
}

export default function RequestForm({ eventId }: RequestFormProps) {
  const [formData, setFormData] = useState<FormData>({
    artist: "",
    title: "",
    side: "",
    name: "",
    comment: "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const trimmedSide = formData.side.trim();
      const trimmedTitle = formData.title.trim();
      const updated = await addOrVoteRequest({
        eventId,
        inventoryId: null,
        recordingId: null,
        artistName: formData.artist.trim(),
        trackTitle: trimmedSide ? `${trimmedTitle} (Side ${trimmedSide})` : trimmedTitle,
        status: "pending",
      });
      setStatus(`Request recorded. Votes: x${updated?.votes ?? 1}`);
      setFormData({ artist: "", title: "", side: "", name: "", comment: "" });
    } catch (err) {
      console.error(err);
      setStatus("Error submitting request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-2">Request a Side</h2>
      <div className="space-y-2">
        <input
          type="text"
          name="artist"
          placeholder="Artist"
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
          value={formData.artist}
        />
        <input
          type="text"
          name="title"
          placeholder="Album Title"
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
          value={formData.title}
        />
        <input
          type="text"
          name="side"
          placeholder="Side (A/B/C...)"
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
          value={formData.side}
        />
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          onChange={handleChange}
          className="w-full p-2 border rounded"
          value={formData.name}
        />
        <textarea
          name="comment"
          placeholder="(Optional) Comment"
          onChange={handleChange}
          className="w-full p-2 border rounded"
          value={formData.comment}
        />
        <button
          className="bg-green-600 text-white py-2 px-4 rounded disabled:opacity-60"
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {status && (
          <p className="text-sm text-center text-gray-600 mt-2">{status}</p>
        )}
      </div>
    </form>
  );
}
