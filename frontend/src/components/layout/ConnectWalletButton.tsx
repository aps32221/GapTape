import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "../ui/Button";
import { shortAddr } from "../../lib/format";

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 font-mono text-xs text-ink-200 sm:inline-block">
          {shortAddr(address)}
        </span>
        <Button variant="ghost" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "injected") ?? connectors[0];

  return (
    <Button variant="primary" disabled={!injectedConnector || isPending} onClick={() => injectedConnector && connect({ connector: injectedConnector })}>
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
