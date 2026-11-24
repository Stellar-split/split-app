/**
 * Adapter for the WalletConnect v2 Stellar service (`src/lib/walletconnect.ts`).
 *
 * The published `@stellar/walletconnect-kit` package does not exist, so this
 * module exposes the `WalletConnectKit` surface consumed by
 * `src/lib/freighter.ts` on top of the in-repo WalletConnect v2 service.
 *
 * Session persistence is delegated to the WalletConnect SDK (it restores
 * active sessions from its own storage), so `getPublicKey()` can recover the
 * connected account after a page refresh without a new approval.
 */
import {
  connectWalletConnect as connectSession,
  disconnectWalletConnect as disconnectSession,
  getWalletConnectPublicKey,
  initWalletConnect,
  signWithWalletConnect,
} from "@/lib/walletconnect";

const SESSION_KEY = "stellarsplit_walletconnect_session";

interface PersistedSession {
  publicKey: string;
  uri: string;
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedSession>;
    if (typeof parsed?.publicKey === "string" && parsed.publicKey.startsWith("G")) {
      return { publicKey: parsed.publicKey, uri: parsed.uri ?? "" };
    }
    return null;
  } catch {
    return null;
  }
}

function writePersistedSession(session: PersistedSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
    } else {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Storage unavailable (private mode) — session just won't survive a refresh.
  }
}

function getProjectId(): string {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
}

/**
 * Returns a `WalletConnectKit`-compatible object backed by the WalletConnect v2
 * service, or `null` when no project id is configured.
 */
export function getStellarWalletKit(): WalletConnectKit | null {
  const projectId = getProjectId();
  if (!projectId) return null;

  return {
    async connect() {
      const persisted = readPersistedSession();
      const publicKey = persisted?.publicKey ?? getWalletConnectPublicKey();
      if (!publicKey) {
        throw new Error("A Stellar public key is required to start a WalletConnect session");
      }

      await initWalletConnect({ projectId });
      const result = await connectSession(publicKey, { projectId });
      writePersistedSession({ publicKey: result.publicKey, uri: result.uri });
      return result;
    },

    getPublicKey() {
      return getWalletConnectPublicKey() ?? readPersistedSession()?.publicKey ?? null;
    },

    async signTransaction(xdr: string, passphrase: string) {
      const result = await signWithWalletConnect(xdr);
      void passphrase;
      return result.signedXdr;
    },

    async disconnect() {
      await disconnectSession();
      writePersistedSession(null);
    },
  };
}
