import { apiClient } from "../lib/api/client";

export async function mintAndListNFT(input: {
  walletAddress: string;
  uri: string;
  priceXrp: number;
  destination?: string;
  taxon?: number;
}) {
  const { data } = await apiClient.post("/nft/mint-and-list", input);
  return data as { nftTokenID: string; offerID: string; hash: string };
}

export async function buyNFT(input: { walletAddress: string; offerID: string }) {
  const { data } = await apiClient.post("/nft/buy", input);
  return data as { hash: string };
}

export async function nftsByAccount(address: string) {
  const { data } = await apiClient.get(`/nft/by-account/${address}`);
  return data as Array<{
    NFTokenID: string;
    URI?: string;
    Issuer: string;
    nft_serial?: number;
    Flags?: number;
  }>;
}
