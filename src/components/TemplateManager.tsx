"use client";

import { useState, useEffect } from "react";
import { encodeTemplate } from "@/lib/templateSharing";


interface Recipient {
  address: string;
  amount: string;
}

interface Template {
  name: string;
  recipients: Recipient[];
  token: string;
}

const STORAGE_KEY = "invoice_templates";
const MAX_TEMPLATES = 10;

interface Props {
  recipients: Recipient[];
  token: string;
  onLoad: (template: Template) => void;
}

export default function TemplateManager({
  recipients,
  token,
  onLoad,
}: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setTemplates(JSON.parse(stored));
      } catch (err) {
        console.error("Failed to parse templates from localStorage", err);
      }
    }
  }, []);

  const saveTemplate = () => {
    const templateName = prompt("Enter template name:");
    if (!templateName) return;

    if (templates.length >= MAX_TEMPLATES) {
      setMessage(`Template limit reached (maximum ${MAX_TEMPLATES})`);
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const newTemplate: Template = {
      name: templateName,
      recipients,
      token,
    };

    const updated = [...templates, newTemplate];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTemplates(updated);
    setMessage("Template saved successfully");
    setTimeout(() => setMessage(null), 2000);
  };

  const loadTemplate = (index: number) => {
    const template = templates[index];
    if (template) {
      onLoad(template);
      setMessage(`Loaded template: ${template.name}`);
      setTimeout(() => setMessage(null), 2000);
    }
  };

  const deleteTemplate = (index: number) => {
    const updated = templates.filter((_, i) => i !== index);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setTemplates(updated);
    setSelectedTemplateIndex(null);
    setMessage("Template deleted");
    setTimeout(() => setMessage(null), 2000);
  };

  const shareTemplate = (index: number) => {
    const template = templates[index];
    if (template) {
      try {
        const encoded = encodeTemplate({
          recipients: template.recipients,
          token: template.token,
        });
        const url = `${window.location.origin}/invoice/new?template=${encoded}`;
        navigator.clipboard.writeText(url);
        setMessage("Shareable link copied to clipboard!");
        setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        console.error("Failed to share template", err);
        setMessage("Error generating shareable link");
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  return (
    <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 mb-6">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Invoice Templates</h2>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <button
          type="button"
          onClick={saveTemplate}
          className="flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors"
        >
          Save as Template
        </button>

        {templates.length > 0 && (
          <div className="flex-1 flex gap-2">
            <select
              value={selectedTemplateIndex ?? ""}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setSelectedTemplateIndex(idx);
              }}
              className="flex-1 min-h-10 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select template...</option>
              {templates.map((t, i) => (
                <option key={i} value={i}>
                  {t.name}
                </option>
              ))}
            </select>
            {selectedTemplateIndex !== null && (
              <>
                <button
                  type="button"
                  onClick={() => loadTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium transition-colors"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => shareTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium transition-colors"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(selectedTemplateIndex)}
                  className="min-h-10 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {message && (
        <p className="text-sm text-green-400">{message}</p>
      )}
    </div>
  );
}
