"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Link as LinkIcon, CheckCircle2, AlertCircle } from "lucide-react";

export interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  folder?: string;
  required?: boolean;
  aspectRatio?: "square" | "video" | "banner" | "wide";
  helperText?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ImageUpload({
  value,
  onChange,
  label = "Upload Image",
  folder = "products",
  required = false,
  aspectRatio = "video",
  helperText,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [customUrl, setCustomUrl] = useState(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setError(null);

    // Validation
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WEBP, GIF, SVG).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folder);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data: unknown = await res.json();

      if (
        !res.ok ||
        !isRecord(data) ||
        data.success !== true ||
        typeof data.url !== "string"
      ) {
        const message =
          isRecord(data) && typeof data.error === "string"
            ? data.error
            : "Failed to upload image";
        throw new Error(message);
      }

      onChange(data.url);
      setCustomUrl(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    onChange("");
    setCustomUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const aspectClass =
    aspectRatio === "square"
      ? "aspect-square"
      : aspectRatio === "banner"
      ? "aspect-[3/1]"
      : aspectRatio === "wide"
      ? "aspect-[16/9]"
      : "aspect-[4/3]";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setIsUrlMode(!isUrlMode)}
          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
        >
          {isUrlMode ? (
            <>
              <Upload className="w-3 h-3" />
              <span>Switch to File Upload</span>
            </>
          ) : (
            <>
              <LinkIcon className="w-3 h-3" />
              <span>Or enter Image URL</span>
            </>
          )}
        </button>
      </div>

      {isUrlMode ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://images.unsplash.com/..."
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                onChange(e.target.value);
              }}
              className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900"
            />
            {customUrl && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>
          {value && (
            <div className={`relative ${aspectClass} rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48`}>
              <Image
                src={value}
                alt="Preview"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          )}
        </div>
      ) : (
        <div>
          {value ? (
            <div className={`relative ${aspectClass} w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group max-h-60`}>
              <Image
                src={value}
                alt="Uploaded product"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white text-slate-900 text-xs font-bold rounded-lg shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1.5 bg-rose-600 text-white rounded-lg shadow-sm hover:bg-rose-700 transition-colors"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-xs">
                <CheckCircle2 className="w-3 h-3" />
                <span>Uploaded</span>
              </div>
            </div>
          ) : (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 ${
                dragActive
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {uploading ? (
                <div className="py-4 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-xs font-semibold text-slate-700">Uploading to Supabase Storage...</p>
                  <p className="text-[11px] text-slate-400">Processing and optimizing image...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 py-2">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 hover:underline">
                      Click to upload
                    </span>
                    <span className="text-xs text-slate-500"> or drag and drop</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PNG, JPG, WEBP, GIF up to 10MB (Powered by Supabase)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-1.5 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helperText && !error && (
        <p className="text-[11px] text-slate-400">{helperText}</p>
      )}
    </div>
  );
}
