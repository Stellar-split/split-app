"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { useWalletContext } from "@/contexts/WalletContext";
import { useInfiniteInvoices } from "@/hooks/useInfiniteInvoices";
import { useInvoiceSelection } from "@/hooks/useInvoiceSelection";
import { useFolders } from "@/hooks/useFolders";
import { useFoldersStore } from "@/lib/stores/foldersStore";
import FolderSidebar from "@/components/folders/FolderSidebar";
import AssignFolderMenu from "@/components/folders/AssignFolderMenu";
import InvoiceCard from "@/components/InvoiceCard";
import InvoiceListSentinel from "@/components/InvoiceListSentinel";
import { InvoiceListSkeleton } from "@/components/Skeleton";

export default function FoldersPage() {
  return (
    <Suspense fallback={<InvoiceListSkeleton />}>
      <FoldersPageInner />
    </Suspense>
  );
}

function FoldersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get("folderId");

  const { address } = useWalletContext();
  const { invoices, isLoading, hasMore, loadMore, isFetchingMore } = useInfiniteInvoices(address);

  const {
    folders,
    foldersByInvoice,
    createFolder,
    renameFolder,
    deleteFolder,
    assignFolders,
  } = useFolders();

  const { sidebarCollapsed, toggleSidebarCollapsed } = useFoldersStore();

  const { selectedIds, isSelecting, toggleSelecting, toggleInvoice, deselectAll, isSelected, selectedCount } =
    useInvoiceSelection();

  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [cardMenuInvoiceId, setCardMenuInvoiceId] = useState<string | null>(null);

  const selectFolder = useCallback(
    (folderId: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (folderId) sp.set("folderId", folderId);
      else sp.delete("folderId");
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const visibleInvoices = useMemo(() => {
    if (!selectedFolderId) return invoices;
    return invoices.filter((inv) => (foldersByInvoice[inv.id] ?? []).includes(selectedFolderId));
  }, [invoices, selectedFolderId, foldersByInvoice]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const folder of folders) out[folder.id] = 0;
    for (const inv of invoices) {
      for (const folderId of foldersByInvoice[inv.id] ?? []) {
        out[folderId] = (out[folderId] ?? 0) + 1;
      }
    }
    out.all = invoices.length;
    return out;
  }, [invoices, folders, foldersByInvoice]);

  if (!address) {
    return (
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-16">
        <p className="text-gray-400">Connect your wallet to view your invoice folders.</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-6 overflow-x-hidden">
      <FolderSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelect={selectFolder}
        onCreate={createFolder}
        onRename={renameFolder}
        onDelete={deleteFolder}
        counts={counts}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold">
            {selectedFolderId
              ? folders.find((f) => f.id === selectedFolderId)?.name ?? "Folder"
              : "All Invoices"}
          </h1>
          <button
            onClick={toggleSelecting}
            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isSelecting ? "Cancel" : "Select"}
          </button>
        </div>

        {isSelecting && selectedCount > 0 && (
          <div className="relative mb-4 flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-300">{selectedCount} selected</span>
            <button
              onClick={() => setBulkMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
            >
              <FolderPlus size={14} /> Add to folder
            </button>
            <button
              onClick={deselectAll}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300"
            >
              Clear
            </button>
            {bulkMenuOpen && (
              <AssignFolderMenu
                invoiceIds={Array.from(selectedIds)}
                folders={folders}
                foldersByInvoice={foldersByInvoice}
                assignFolders={assignFolders}
                createFolder={createFolder}
                onClose={() => setBulkMenuOpen(false)}
              />
            )}
          </div>
        )}

        {isLoading ? (
          <InvoiceListSkeleton />
        ) : visibleInvoices.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            {selectedFolderId ? "No invoices in this folder yet." : "No invoices yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleInvoices.map((invoice) => (
              <div key={invoice.id} className="relative">
                <div className="flex items-start gap-2">
                  {isSelecting && (
                    <input
                      type="checkbox"
                      checked={isSelected(invoice.id)}
                      onChange={() => toggleInvoice(invoice.id)}
                      className="mt-5 shrink-0"
                      aria-label={`Select invoice ${invoice.id}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <Link href={`/invoice/${invoice.id}`} className="block">
                      <InvoiceCard invoice={invoice} />
                    </Link>
                  </div>
                  <button
                    onClick={() => setCardMenuInvoiceId((id) => (id === invoice.id ? null : invoice.id))}
                    className="mt-3 p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                    aria-label={`Manage folders for invoice ${invoice.id}`}
                  >
                    <FolderPlus size={16} />
                  </button>
                </div>
                {cardMenuInvoiceId === invoice.id && (
                  <div className="absolute right-0 top-full">
                    <AssignFolderMenu
                      invoiceIds={[invoice.id]}
                      folders={folders}
                      foldersByInvoice={foldersByInvoice}
                      assignFolders={assignFolders}
                      createFolder={createFolder}
                      onClose={() => setCardMenuInvoiceId(null)}
                    />
                  </div>
                )}
              </div>
            ))}
            <InvoiceListSentinel
              onVisible={loadMore}
              loading={isFetchingMore}
              allLoaded={!hasMore}
            />
          </div>
        )}
      </div>
    </main>
  );
}
