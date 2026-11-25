import Foundation
import SwiftData

/// Offline-first invoice store.
///
/// Reads always come from SwiftData so the UI works with no network; sync
/// pulls pages from the API and merges them into the cache. Failed syncs are
/// retried with exponential backoff by `SyncCoordinator`.
@MainActor
final class InvoiceStore: ObservableObject {
    @Published private(set) var invoices: [Invoice] = []
    @Published private(set) var isSyncing = false
    @Published private(set) var lastSyncedAt: Date?
    @Published var errorMessage: String?

    private let context: ModelContext
    private let client: APIClient
    private let publicKey: String

    init(context: ModelContext, client: APIClient = .shared, publicKey: String) {
        self.context = context
        self.client = client
        self.publicKey = publicKey
        loadFromCache()
    }

    /// Loads cached invoices, newest first.
    func loadFromCache() {
        let descriptor = FetchDescriptor<CachedInvoice>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        let rows = (try? context.fetch(descriptor)) ?? []
        invoices = rows.map { $0.toInvoice() }
    }

    /// Pulls every page of invoices and merges them into the cache.
    func sync() async {
        guard !isSyncing else { return }
        isSyncing = true
        defer { isSyncing = false }

        var cursor: String?
        var fetched: [Invoice] = []
        do {
            repeat {
                let page = try await client.listInvoices(publicKey: publicKey, cursor: cursor)
                fetched.append(contentsOf: page.invoices)
                cursor = page.nextCursor
            } while cursor != nil

            merge(fetched)
            lastSyncedAt = Date()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Refreshes a single invoice (used after a payment notification).
    func refresh(id: String) async {
        do {
            let invoice = try await client.invoice(id: id)
            merge([invoice])
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func merge(_ fetched: [Invoice]) {
        let existing = (try? context.fetch(FetchDescriptor<CachedInvoice>())) ?? []
        var byID = Dictionary(uniqueKeysWithValues: existing.map { ($0.id, $0) })
        let now = Date()

        for invoice in fetched {
            if let row = byID[invoice.id] {
                row.merge(invoice, at: now)
            } else {
                let row = CachedInvoice(invoice: invoice, updatedAt: now)
                context.insert(row)
                byID[invoice.id] = row
            }
        }

        try? context.save()
        loadFromCache()
    }
}
