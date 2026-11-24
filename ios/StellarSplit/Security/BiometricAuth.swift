import Foundation
import LocalAuthentication

/// Face ID / Touch ID gate for opening the app and revealing invoice data.
///
/// The biometric check protects a keychain-stored session; it never replaces
/// the Stellar keypair, which stays in the user's wallet.
final class BiometricAuth {
    static let shared = BiometricAuth()

    private let context = LAContext()

    /// Whether the device can evaluate biometrics right now.
    var isAvailable: Bool {
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
    }

    var biometryType: LABiometryType {
        var error: NSError?
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return context.biometryType
    }

    /// Prompts for biometrics (falling back to the device passcode).
    /// - Returns: `true` when the user authenticated successfully.
    @discardableResult
    func authenticate(reason: String = "Unlock StellarSplit") async -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"
        do {
            return try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
        } catch {
            return false
        }
    }
}
