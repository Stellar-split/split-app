"use client";

import { useRouter } from "next/navigation";
import { templates } from "@/data/templates";

export default function TemplatesPage() {
  const router = useRouter();

  const handleUseTemplate = (templateIndex: number) => {
    const template = templates[templateIndex];
    sessionStorage.setItem("invoiceTemplate", JSON.stringify(template));
    router.push("/invoice/new");
  };

  return (
    <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-16 overflow-x-hidden">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Invoice Templates</h1>
        <p className="text-gray-400">Choose a template to get started quickly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-indigo-500 transition-colors"
          >
            <h3 className="text-lg font-semibold mb-1">{template.name}</h3>
            <p className="text-sm text-gray-400 mb-3">{template.description}</p>
            <div className="mb-4 text-xs text-gray-500">
              <p>{template.recipients.length} recipient{template.recipients.length !== 1 ? "s" : ""}</p>
              <p>{template.deadlineDays} day deadline</p>
            </div>
            <button
              type="button"
              onClick={() => handleUseTemplate(i)}
              className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
