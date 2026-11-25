import Foundation

/// Retries invoice sync with exponential backoff and jitter.
///
/// Runs on launch, when connectivity returns, and on a foreground timer so
/// cached data converges without user action.
@MainActor
final class SyncCoordinator: ObservableObject {
    private let store: InvoiceStore
    private let monitor: NetworkMonitor
    private let maxAttempts: Int
    private var task: Task<Void, Never>?

    init(store: InvoiceStore, monitor: NetworkMonitor = .shared, maxAttempts: Int = 5) {
        self.store = store
        self.monitor = monitor
        self.maxAttempts = maxAttempts
    }

    /// Starts a sync loop; safe to call repeatedly.
    func start() {
        guard task == nil else { return }
        task = Task { [weak self] in
            guard let self else { return }
            var attempt = 0
            while !Task.isCancelled {
                if monitor.isOnline {
                    await store.sync()
                    if store.errorMessage == nil {
                        attempt = 0
                    } else {
                        attempt += 1
                        if attempt >= maxAttempts { break }
                    }
                }
                let delay = Self.backoff(attempt: attempt)
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }

    /// Exponential backoff capped at 5 minutes, with up to 20% jitter.
    static func backoff(attempt: Int) -> TimeInterval {
        let base = min(pow(2.0, Double(max(attempt, 0))) * 5, 300)
        return base * Double.random(in: 0.8...1.0)
    }
}
