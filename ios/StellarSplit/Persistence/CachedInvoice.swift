import Foundation
import SwiftData

/// SwiftData model mirroring `Invoice` for offline reads.
///
/// Amounts stay as strings so no precision is lost between the API and the
/// local store. `updatedAt` drives last-write-wins conflict resolution.
@Model
final class CachedInvoice {
    @Attribute(.unique) var id: String
    var creator: String
    var title: String?
    var memo: String?
    var status: String
    var funded: String
    var deadline: Int
    var createdAt: Int?
    var recipientsJSON: String
    var paymentsJSON: String
    var updatedAt: Date

    init(invoice: Invoice, updatedAt: Date = Date()) {
        self.id = invoice.id
        self.creator = invoice.creator
        self.title = invoice.title
        self.memo = invoice.memo
        self.status = invoice.status
        self.funded = invoice.funded
        self.deadline = invoice.deadline
        self.createdAt = invoice.createdAt
        self.recipientsJSON = Self.encode(invoice.recipients)
        self.paymentsJSON = Self.encode(invoice.payments)
        self.updatedAt = updatedAt
    }

    /// Rebuilds the API model from the cached row.
    func toInvoice() -> Invoice {
        Invoice(
            id: id,
            creator: creator,
            token: nil,
            title: title,
            memo: memo,
            status: status,
            funded: funded,
            deadline: deadline,
            createdAt: createdAt,
            recipients: Self.decode(recipientsJSON) ?? [],
            payments: Self.decode(paymentsJSON) ?? []
        )
    }

    /// Applies a freshly fetched invoice, keeping the newest copy.
    func merge(_ invoice: Invoice, at date: Date = Date()) {
        guard date >= updatedAt else { return }
        creator = invoice.creator
        title = invoice.title
        memo = invoice.memo
        status = invoice.status
        funded = invoice.funded
        deadline = invoice.deadline
        createdAt = invoice.createdAt
        recipientsJSON = Self.encode(invoice.recipients)
        paymentsJSON = Self.encode(invoice.payments)
        updatedAt = date
    }

    private static func encode<T: Encodable>(_ value: T) -> String {
        guard let data = try? JSONEncoder().encode(value) else { return "[]" }
        return String(data: data, encoding: .utf8) ?? "[]"
    }

    private static func decode<T: Decodable>(_ json: String) -> T? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }
}
