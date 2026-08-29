'use client';
import React, { useState } from 'react';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { InvoiceStatus } from '@/lib/invoiceStateMachine';

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [invoices, setInvoices] = useState([
    { id: 'INV-001', recipientCount: 3, amount: '150 XLM', dueDate: '2026-09-01', status: 'Draft' as InvoiceStatus },
    { id: 'INV-002', recipientCount: 1, amount: '500 XLM', dueDate: '2026-08-28', status: 'Pending' as InvoiceStatus },
  ]);

  const handleStatusChange = async (id: string, newStatus: InvoiceStatus) => {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('API update failed');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded ${viewMode === 'list' ? 'bg-black text-white' : 'bg-gray-200'}`}>List View</button>
          <button onClick={() => setViewMode('kanban')} className={`px-4 py-2 rounded ${viewMode === 'kanban' ? 'bg-black text-white' : 'bg-gray-200'}`}>Kanban Board</button>
        </div>
      </div>

      {toastMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded shadow">
          {toastMessage}
        </div>
      )}

      {viewMode === 'kanban' ? (
        <KanbanBoard invoices={invoices} onStatusChange={handleStatusChange} onToast={showToast} />
      ) : (
        <div>Standard List/Table View Component Content...</div>
      )}
    </div>
  );
}
