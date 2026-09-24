import { createConfig, http } from "wagmi";
import { bscTestnet, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const localChain = { ...hardhat, name: "GapTape Local" };

// bscTestnet first: it's the default/fallback chain wagmi uses for reads when
// no wallet is connected, and this deployment now targets BSC testnet.
export const wagmiConfig = createConfig({
  chains: [bscTestnet, localChain],
  connectors: [injected()],
  transports: {
    [localChain.id]: http("http://127.0.0.1:8545"),
    [bscTestnet.id]: http("https://data-seed-prebsc-1-s1.binance.org:8545"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
