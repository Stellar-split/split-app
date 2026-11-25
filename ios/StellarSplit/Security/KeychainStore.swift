import Foundation
import Security

/// Keychain-backed storage for the API key and the biometric session flag.
///
/// Secrets never touch `UserDefaults`; only non-sensitive preferences do.
struct KeychainStore {
    private let service = "app.stellarsplit.ios"

    enum Key: String {
        case apiKey = "apiKey"
        case sessionPublicKey = "sessionPublicKey"
    }

    func save(_ value: String, for key: Key) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(attributes as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
    }

    func read(_ key: Key) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(_ key: Key) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }

    func readAPIKey() throws -> String? { read(.apiKey) }

    enum KeychainError: LocalizedError {
        case unhandled(OSStatus)
        var errorDescription: String? {
            switch self {
            case .unhandled(let status): return "Keychain error \(status)."
            }
        }
    }
}
