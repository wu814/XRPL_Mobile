import {
  type Client,
  dropsToXrp,
  type AccountLinesTrustline,
  type AccountInfoResponse,
  type AccountLinesResponse,
} from "xrpl";

export async function getAccountInfo(client: Client, address: string) {
  if (!client.isConnected()) await client.connect();
  const response: AccountInfoResponse = await client.request({
    command: "account_info",
    account: address,
    ledger_index: "validated",
  });
  const accountData = response.result.account_data;
  if (accountData.Balance) {
    accountData.Balance = dropsToXrp(accountData.Balance).toString();
  }
  return accountData;
}

export async function getAccountLines(
  client: Client,
  address: string,
): Promise<AccountLinesTrustline[]> {
  if (!client.isConnected()) await client.connect();
  const response: AccountLinesResponse = await client.request({
    command: "account_lines",
    account: address,
    ledger_index: "validated",
  });
  return response.result.lines;
}
