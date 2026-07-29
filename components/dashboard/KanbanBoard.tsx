'use client';

import React, { useState } from 'react';
import { InvoiceStatus, isValidTransition } from '@/lib/invoiceStateMachine';

interface Invoice {
  id: string;
  recipientCount: number;
  amount: string;
  dueDate: string;
  status: InvoiceStatus;
}

const COLUMNS: InvoiceStatus[] = ['Draft', 'Pending', 'Partially Paid', 'Fully Paid', 'Disputed'];

export const KanbanBoard: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: 'INV-001', recipientCount: 3, amount: '$1,200.00', dueDate: '2026-08-01', status: 'Draft' },
    { id: 'INV-002', recipientCount: 5, amount: '$3,450.00', dueDate: '2026-08-05', status: 'Pending' },
  ]);
  const [toast, setToast] = useState<string | null>(null);

  const handleStatusChange = (invoiceId: string, newStatus: InvoiceStatus) => {
    setInvoices((prev) => {
      const inv = prev.find((i) => i.id === invoiceId);
      if (!inv) return prev;

      if (!isValidTransition(inv.status, newStatus)) {
        setToast(`Invalid transition from ${inv.status} to ${newStatus}`);
        setTimeout(() => setToast(null), 4000);
        return prev;
      }

      return prev.map((i) => (i.id === invoiceId ? { ...i, status: newStatus } : i));
    });
  };

  return (
    <div className="p-6">
      {toast && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm" role="alert">
          {toast}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div key={col} className="bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-[70vh] overflow-y-auto">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">{col}</h3>
            <div className="space-y-3">
              {invoices
                .filter((inv) => inv.status === col)
                .map((inv) => (
                  <div key={inv.id} className="p-3 bg-white rounded shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-xs text-gray-900">{inv.id}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{inv.amount}</span>
                    </div>
                    <p className="text-xs text-gray-500">Recipients: {inv.recipientCount}</p>
                    <p className="text-xs text-gray-400 mt-1">Due: {inv.dueDate}</p>
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {COLUMNS.filter((c) => c !== col).map((targetCol) => (
                        <button
                          key={targetCol}
                          onClick={() => handleStatusChange(inv.id, targetCol)}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-200 rounded hover:opacity-80"
                        >
                          {targetCol}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
