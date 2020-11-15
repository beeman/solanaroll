import React, { useContext, useEffect, useMemo, useState } from "react";
import Wallet from "@project-serum/sol-wallet-adapter";
import { useConnectionConfig } from "./connection";
import { useLocalStorageState } from "./utils";

export const WALLET_PROVIDERS = [
  { name: "sollet.io", url: "https://www.sollet.io" },
  { name: "solflare.com", url: "https://solflare.com/access-wallet" },
];

const WalletContext = React.createContext<any>(null);

export function WalletProvider({ children = null as any }) {
  const { endpoint } = useConnectionConfig();
  const [providerUrl, setProviderUrl] = useLocalStorageState(
    "walletProvider",
    "https://www.sollet.io"
  );
  const wallet = useMemo(() => new Wallet(providerUrl, endpoint), [
    providerUrl,
    endpoint,
  ]);
  let balance = 0;

  const [connected, setConnected] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  useEffect(() => {
    console.log("trying to connect");
    console.log(endpoint);
    wallet.on("connect", () => {
      console.log("connected");
      setConnected(true);
      let walletPublicKey = wallet.publicKey.toBase58();
      let keyToDisplay =
        walletPublicKey.length > 20
          ? `${walletPublicKey.substring(0, 7)}.....${walletPublicKey.substring(
              walletPublicKey.length - 7,
              walletPublicKey.length
            )}`
          : walletPublicKey;
      console.log('wallet to use : ' + keyToDisplay);
      setPublicKey(wallet.publicKey.toBase58());
      // notify({
      //   message: "Wallet update",
      //   description: "Connected to wallet " + keyToDisplay,
      // });
    });
    wallet.on("disconnect", () => {
      setConnected(false);
      // notify({
      //   message: "Wallet update",
      //   description: "Disconnected from wallet",
      // });
    });
    return () => {
      wallet.disconnect();
      setConnected(false);
    };
  }, [wallet]);
  return (
    <WalletContext.Provider
      value={{
        publicKey,
        wallet,
        connected,
        balance,
        providerUrl,
        setProviderUrl,
        providerName:
          WALLET_PROVIDERS.find(({ url }) => url === providerUrl)?.name ??
          providerUrl,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  return {
    connected: context.connected,
    publicKey: context.publicKey,
    wallet: context.wallet,
    providerUrl: context.providerUrl,
    setProvider: context.setProviderUrl,
    providerName: context.providerName,
  };
}
