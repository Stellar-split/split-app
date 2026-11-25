import Foundation

/// Errors surfaced by `APIClient`.
enum APIError: LocalizedError {
    case invalidURL
    case unauthorized
    case notFound
    case rateLimited(retryAfter: TimeInterval?)
    case server(code: String, message: String)
    case transport(Error)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "The request URL could not be built."
        case .unauthorized: return "Your session has expired. Please sign in again."
        case .notFound: return "The requested invoice was not found."
        case .rateLimited(let retryAfter):
            if let retryAfter { return "Too many requests. Try again in \(Int(retryAfter))s." }
            return "Too many requests. Try again shortly."
        case .server(_, let message): return message
        case .transport(let error): return error.localizedDescription
        case .decoding: return "The server returned an unexpected response."
        }
    }
}

/// Thin async client for the StellarSplit v1 REST API (`/api/v1`).
///
/// Mirrors `docs/REST_API.md`: bearer API-key auth, `{ data, meta }` success
/// envelope, `{ error: { code, message } }` failure envelope, and bigint
/// amounts serialized as base-10 strings.
final class APIClient {
    static let shared = APIClient()

    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let keychain: KeychainStore

    init(
        baseURL: URL = URL(string: "https://stellarsplit.app")!,
        session: URLSession = .shared,
        keychain: KeychainStore = KeychainStore()
    ) {
        self.baseURL = baseURL
        self.session = session
        self.keychain = keychain
        self.decoder = JSONDecoder()
    }

    // MARK: - Endpoints

    /// `GET /api/v1/invoices?publicKey=...&cursor=...&limit=...&q=...`
    func listInvoices(
        publicKey: String,
        cursor: String? = nil,
        limit: Int = 20,
        query: String? = nil
    ) async throws -> InvoicePage {
        var items = [
            URLQueryItem(name: "publicKey", value: publicKey),
            URLQueryItem(name: "limit", value: String(min(max(limit, 1), 50))),
        ]
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        if let query, !query.isEmpty { items.append(URLQueryItem(name: "q", value: query)) }
        let page: InvoicePage = try await get(path: "/api/v1/invoices", query: items)
        return page
    }

    /// `GET /api/v1/invoices/{id}`
    func invoice(id: String) async throws -> Invoice {
        let payload: InvoiceEnvelope = try await get(path: "/api/v1/invoices/\(id)")
        return payload.invoice
    }

    /// `GET /api/v1/invoices/{id}/history?cursor=...&limit=...`
    func paymentHistory(invoiceID: String, cursor: Int = 0, limit: Int = 10) async throws -> PaymentPage {
        let items = [
            URLQueryItem(name: "cursor", value: String(max(cursor, 0))),
            URLQueryItem(name: "limit", value: String(min(max(limit, 1), 50))),
        ]
        return try await get(path: "/api/v1/invoices/\(invoiceID)/history", query: items)
    }

    // MARK: - Transport

    private func get<T: Decodable>(path: String, query: [URLQueryItem] = []) async throws -> T {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let key = try keychain.readAPIKey() {
            request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.decoding(URLError(.badServerResponse)) }

        switch http.statusCode {
        case 200..<300:
            do {
                let envelope = try decoder.decode(Envelope<T>.self, from: data)
                return envelope.data
            } catch {
                throw APIError.decoding(error)
            }
        case 401:
            throw APIError.unauthorized
        case 404:
            throw APIError.notFound
        case 429:
            let retry = http.value(forHTTPHeaderField: "Retry-After").flatMap(TimeInterval.init)
            throw APIError.rateLimited(retryAfter: retry)
        default:
            let failure = try? decoder.decode(ErrorEnvelope.self, from: data)
            throw APIError.server(
                code: failure?.error.code ?? "HTTP_\(http.statusCode)",
                message: failure?.error.message ?? "Request failed with status \(http.statusCode)."
            )
        }
    }
}

// MARK: - Envelopes

private struct Envelope<T: Decodable>: Decodable {
    let data: T
    let meta: Meta?
}

private struct Meta: Decodable {
    let apiVersion: String?
    let requestId: String?
}

private struct ErrorEnvelope: Decodable {
    struct Payload: Decodable {
        let code: String
        let message: String
    }
    let error: Payload
}

private struct InvoiceEnvelope: Decodable {
    let invoice: Invoice
}
