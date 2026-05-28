import { Alert } from "react-native";
import { WalletSummaryCard } from "./WalletSummaryCard";
import { useWalletAssets } from "@/src/hooks/useWalletAssets";
import { useDeleteWallet } from "@/src/hooks/useWallets";
import type { WalletSummary } from "@/src/api/wallets";

interface WalletCardContainerProps {
  wallet: WalletSummary;
  onTransfer: (wallet: WalletSummary) => void;
}

export function WalletCardContainer({ wallet, onTransfer }: WalletCardContainerProps) {
  const assets = useWalletAssets(wallet.classic_address);
  const deleteMut = useDeleteWallet();

  const onDelete = async () => {
    try {
      await deleteMut.mutateAsync(wallet.classic_address);
    } catch (err) {
      Alert.alert("Delete failed", (err as Error).message);
    }
  };

  return (
    <WalletSummaryCard
      wallet={wallet}
      balance={assets.summary}
      isLoading={assets.isLoading}
      onTransfer={() => onTransfer(wallet)}
      onDelete={onDelete}
    />
  );
}
