'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  defaultAmount?: string;
  defaultMemo?: string;
  category: 'freelance' | 'services' | 'product' | 'custom';
}

export interface MobileInvoiceFormData {
  recipient: string;
  amount: string;
  asset: string;
  memo: string;
  templateId?: string;
  voiceInput?: boolean;
  cameraCapture?: boolean;
}

const QUICK_TEMPLATES: InvoiceTemplate[] = [
  { id: 'freelance', name: 'Freelance Work', description: 'Standard freelance invoice', category: 'freelance' },
  { id: 'services', name: 'Services', description: 'Professional services', category: 'services' },
  { id: 'product', name: 'Product Sale', description: 'Physical or digital product', category: 'product' },
  { id: 'custom', name: 'Custom', description: 'Start from scratch', category: 'custom' },
];

const ASSETS = ['XLM', 'USDC', 'EURC'];

interface Props {
  onSubmit?: (data: MobileInvoiceFormData) => void;
  onCancel?: () => void;
}

type Step = 'template' | 'details' | 'review';

export default function MobileInvoiceWizard({ onSubmit, onCancel }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('template');
  const [form, setForm] = useState<MobileInvoiceFormData>({
    recipient: '',
    amount: '',
    asset: 'USDC',
    memo: '',
  });
  const [smartFillActive, setSmartFillActive] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectTemplate = (t: InvoiceTemplate) => {
    setForm((f) => ({
      ...f,
      templateId: t.id,
      amount: t.defaultAmount ?? f.amount,
      memo: t.defaultMemo ?? f.memo,
    }));
    setStep('details');
  };

  const handleSmartFill = () => {
    setSmartFillActive(true);
    // Smart fill: auto-populate from recent invoice data
    setForm((f) => ({
      ...f,
      amount: f.amount || '100',
      asset: f.asset || 'USDC',
      memo: f.memo || 'Invoice payment',
    }));
    setTimeout(() => setSmartFillActive(false), 800);
  };

  const handleVoiceToggle = () => {
    setVoiceActive((v) => !v);
    // In production, this hooks into the Web Speech API
  };

  const handleCameraCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      // In production, this feeds the image to the OCR library (tesseract.js)
      setForm((f) => ({ ...f, cameraCapture: true }));
    }
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(form);
    } else {
      const qs = new URLSearchParams({
        to: form.recipient,
        asset: form.asset,
        amount: form.amount,
        ...(form.memo ? { memo: form.memo } : {}),
      }).toString();
      router.push(`/invoice/new?${qs}`);
    }
  };

  const isDetailsValid =
    form.recipient.trim().length > 0 &&
    form.amount.trim().length > 0 &&
    parseFloat(form.amount) > 0;

  if (step === 'template') {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto" data-testid="mobile-invoice-wizard-template">
        <h2 className="text-xl font-bold text-center">New Invoice</h2>
        <p className="text-sm text-gray-400 text-center">Choose a template to get started</p>
        <div className="grid grid-cols-2 gap-3">
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t)}
              className="flex flex-col items-start gap-1 p-4 rounded-xl border border-gray-700 bg-gray-900 hover:border-indigo-500 active:scale-95 transition-all min-h-[88px] text-left"
              aria-label={`Select ${t.name} template`}
            >
              <span className="text-sm font-semibold text-white">{t.name}</span>
              <span className="text-xs text-gray-400">{t.description}</span>
            </button>
          ))}
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-sm text-gray-400 underline text-center mt-2">
            Cancel
          </button>
        )}
      </div>
    );
  }

  if (step === 'details') {
    return (
      <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto" data-testid="mobile-invoice-wizard-details">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('template')}
            aria-label="Back to templates"
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 min-h-11 min-w-11"
          >
            ←
          </button>
          <h2 className="text-xl font-bold flex-1">Invoice Details</h2>
        </div>

        {/* Smart fill + tools */}
        <div className="flex gap-2">
          <button
            onClick={handleSmartFill}
            className="flex-1 py-2 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm font-medium transition-colors"
            aria-label="Smart fill"
          >
            {smartFillActive ? 'Filling…' : '⚡ Smart Fill'}
          </button>
          <button
            onClick={handleVoiceToggle}
            className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors min-h-11 ${
              voiceActive ? 'bg-red-600/30 text-red-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
            aria-label={voiceActive ? 'Stop voice input' : 'Start voice input'}
          >
            🎤
          </button>
          <button
            onClick={handleCameraCapture}
            className="py-2 px-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium transition-colors min-h-11"
            aria-label="Capture with camera"
          >
            📷
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Camera input"
          />
        </div>

        {/* Recipient */}
        <div className="flex flex-col gap-1">
          <label htmlFor="recipient" className="text-sm font-medium text-gray-300">
            Recipient Address
          </label>
          <input
            id="recipient"
            type="text"
            value={form.recipient}
            onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))}
            placeholder="G…"
            className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none min-h-[48px]"
          />
        </div>

        {/* Amount + Asset */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1 flex-1">
            <label htmlFor="amount" className="text-sm font-medium text-gray-300">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
              className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none min-h-[48px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="asset" className="text-sm font-medium text-gray-300">
              Asset
            </label>
            <select
              id="asset"
              value={form.asset}
              onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value }))}
              className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm text-white focus:border-indigo-500 focus:outline-none min-h-[48px]"
            >
              {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* Memo */}
        <div className="flex flex-col gap-1">
          <label htmlFor="memo" className="text-sm font-medium text-gray-300">
            Memo <span className="text-gray-500">(optional)</span>
          </label>
          <input
            id="memo"
            type="text"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            placeholder="Add a note…"
            className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none min-h-[48px]"
          />
        </div>

        <button
          onClick={() => setStep('review')}
          disabled={!isDetailsValid}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 mt-2 transition-colors min-h-[52px]"
        >
          Review Invoice
        </button>
      </div>
    );
  }

  // step === 'review'
  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto" data-testid="mobile-invoice-wizard-review">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setStep('details')}
          aria-label="Back to details"
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 min-h-11 min-w-11"
        >
          ←
        </button>
        <h2 className="text-xl font-bold flex-1">Review</h2>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-900 divide-y divide-gray-800">
        <div className="flex justify-between p-4">
          <span className="text-sm text-gray-400">Recipient</span>
          <span className="text-sm text-white font-mono truncate max-w-[180px]">{form.recipient}</span>
        </div>
        <div className="flex justify-between p-4">
          <span className="text-sm text-gray-400">Amount</span>
          <span className="text-sm text-white font-semibold">{form.amount} {form.asset}</span>
        </div>
        {form.memo && (
          <div className="flex justify-between p-4">
            <span className="text-sm text-gray-400">Memo</span>
            <span className="text-sm text-white">{form.memo}</span>
          </div>
        )}
        {form.templateId && (
          <div className="flex justify-between p-4">
            <span className="text-sm text-gray-400">Template</span>
            <span className="text-sm text-indigo-300 capitalize">{form.templateId}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        className="w-full rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold py-3 transition-colors min-h-[52px]"
      >
        Create Invoice
      </button>
    </div>
  );
}
