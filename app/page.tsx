"use client"
import { cn } from "@/utils/cn";
import { sourGummy } from "@/utils/font";
import { Upload } from "lucide-react";
import { useCallback, useState } from "react";

export default function Home() {

  const maxFileSize = 5 * 1024 * 1024;

  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (file.size > maxFileSize) {
      setError(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/validate-emails', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if ('error' in data) {
        throw new Error(data.error);
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const preventDefault = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  return (
    <div>
      <nav className="bg-white border-b-[1px] border-b-[#f2f3f4] h-[74px] text-center grid place-items-center">
        <h1 className={cn("text-[32px] font-medium", sourGummy.className)}>Email Validator</h1>
      </nav>

      <div className="pt-24 px-[24px]">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-xl w-full mx-auto"
          onDrop={handleDrop}
          onDragOver={preventDefault}
          onDragEnter={preventDefault}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 mb-2">
            Drop your file here or click to upload
          </p>
          <label className="inline-block">
            <span className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer hover:bg-blue-600">
              Select File
            </span>
            <input
              type="file"
              className="hidden"
              accept=".txt,.csv"
              onChange={handleFileUpload}
            />
          </label>
          <p className="mt-2 text-sm text-gray-500">
            Accepts .txt or .csv file
          </p>
        </div>

      </div>
    </div>
  );
}
