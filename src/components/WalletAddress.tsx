interface Props { address: string; truncate?: boolean; }
export default function WalletAddress({ address, truncate = true }: Props) {
  const display = truncate ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
  return <span className="font-mono text-sm" title={address}>{display}</span>;
}
