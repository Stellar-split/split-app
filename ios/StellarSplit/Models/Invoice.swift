import Foundation

/// A StellarSplit invoice as returned by `/api/v1/invoices`.
///
/// Amounts are base-10 strings on the wire (SDK `bigint`), so they are kept as
/// `String` here and converted with `Decimal` only for display.
struct Invoice: Codable, Identifiable, Equatable {
    let id: String
    let creator: String
    let token: String?
    let title: String?
    let memo: String?
    let status: String
    let funded: String
    let deadline: Int
    let createdAt: Int?
    let recipients: [Recipient]
    let payments: [Payment]

    /// Total of all recipient amounts, in base units.
    var totalAmount: Decimal {
        recipients.reduce(Decimal.zero) { $0 + (Decimal(string: $1.amount) ?? .zero) }
    }

    /// Funded amount, in base units.
    var fundedAmount: Decimal {
        Decimal(string: funded) ?? .zero
    }

    /// Lifecycle status shown in the app, derived the same way as the web
    /// dashboard (`getInvoiceDisplayStatus`).
    func displayStatus(now: Date = Date()) -> DisplayStatus {
        if status == "Released" { return .released }
        if status == "Refunded" { return .refunded }
        let nowSeconds = Int(now.timeIntervalSince1970)
        if deadline > 0 && deadline < nowSeconds { return .expired }
        if totalAmount > 0 && fundedAmount >= totalAmount { return .funded }
        if fundedAmount > 0 { return .partial }
        return .pending
    }

    enum DisplayStatus: String, CaseIterable {
        case pending = "Pending"
        case partial = "Partial"
        case funded = "Funded"
        case released = "Released"
        case expired = "Expired"
        case refunded = "Refunded"
    }

    struct Recipient: Codable, Equatable, Identifiable {
        var id: String { address }
        let address: String
        let amount: String
    }

    struct Payment: Codable, Equatable, Identifiable {
        var id: String { "\(payer)-\(amount)-\(timestamp ?? 0)" }
        let payer: String
        let amount: String
        let timestamp: Int?
    }
}

/// One page of invoices plus the cursor for the next page.
struct InvoicePage: Codable, Equatable {
    let invoices: [Invoice]
    let nextCursor: String?
}

/// One page of payments plus the next offset cursor.
struct PaymentPage: Codable, Equatable {
    let payments: [Invoice.Payment]
    let nextCursor: String?
}
