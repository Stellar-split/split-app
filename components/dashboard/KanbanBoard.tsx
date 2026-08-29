'tsx' // placeholder for syntax hint
import React, { useState } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { InvoiceStatus, statusTransitionGuard } from '@/lib/invoiceStateMachine';

interface InvoiceCardData {
  id: string;
  recipientCount: number;
  amount: string;
  dueDate: string;
  status: InvoiceStatus;
}

interface KanbanBoardProps {
  invoices: InvoiceCardData[];
  onStatusChange: (id: string, newStatus: InvoiceStatus) => Promise<void>;
  onToast: (msg: string) => void;
}

const COLUMNS: InvoiceStatus[] = ['Draft', 'Pending', 'Partially Paid', 'Fully Paid', 'Disputed'];

function SortableItem({ invoice }: { invoice: InvoiceCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: invoice.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} tabIndex={0} className="bg-white p-4 rounded-lg shadow mb-3 cursor-grab focus:outline-none focus:ring-2 focus:ring-indigo-500">
      <div className="font-semibold text-gray-900">ID: {invoice.id}</div>
      <div className="text-sm text-gray-600">Recipients: {invoice.recipientCount}</div>
      <div className="text-sm font-medium text-gray-800 mt-1">{invoice.amount}</div>
      <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">Due: {invoice.dueDate}</span>
    </div>
  );
}

export function KanbanBoard({ invoices, onStatusChange, onToast }: KanbanBoardProps) {
  const [items, setItems] = useState(invoices);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const targetStatus = over.id as InvoiceStatus;

    const card = items.find((i) => i.id === activeId);
    if (!card) return;

    if (!statusTransitionGuard(card.status, targetStatus)) {
      onToast(`Invalid transition from ${card.status} to ${targetStatus}`);
      return;
    }

    const previousStatus = card.status;
    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, status: targetStatus } : i)));

    try {
      await onStatusChange(activeId, targetStatus);
    } catch {
      // Rollback on failure
      setItems((prev) => prev.map((i) => (i.id === activeId ? { ...i, status: previousStatus } : i)));
      onToast('Failed to update status on server. Rolled back.');
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 w-full">
        {COLUMNS.map((col) => (
          <div key={col} id={col} className="bg-gray-50 rounded-xl p-4 w-80 flex-shrink-0 flex flex-col max-h-[75vh]">
            <h3 className="font-bold text-gray-700 mb-3 sticky top-0 bg-gray-50 py-1">{col}</h3>
            <div className="overflow-y-auto flex-1 pr-1">
              <SortableContext items={items.filter((i) => i.status === col).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                {items.filter((i) => i.status === col).map((inv) => (
                  <SortableItem key={inv.id} invoice={inv} />
                ))}
              </SortableContext>
            </div>
          </div>
        ))}
      </div>
    </DndContext>
  );
}
