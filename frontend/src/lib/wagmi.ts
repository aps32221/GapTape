import { createConfig, http } from "wagmi";
import { bscTestnet, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const localChain = { ...hardhat, name: "GapTape Local" };

export const wagmiConfig = createConfig({
  chains: [localChain, bscTestnet],
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
