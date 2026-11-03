export function WalletAddress({ address, short, showCopy }: { address: string; short?: boolean; showCopy?: boolean }) {
  const handleCopy = () => {
    if (showCopy) {
      navigator.clipboard.writeText(address);
    }
  };

  return (
    <span className="wallet-address cursor-pointer" onClick={handleCopy}>
      {short ? address.slice(0, 6) + '...' + address.slice(-6) : address}
      {showCopy && <span className="ml-2">📋</span>}
    </span>
  );
}

export default WalletAddress;
