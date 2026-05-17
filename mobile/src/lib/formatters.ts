/**
 * Pure formatting helpers (duplicated from xrpl_mvp - intentionally not shared
 * because mobile and web are separate repos by design).
 */

const DROPS_PER_XRP = 1_000_000;

export function dropsToXrp(drops: string | number): number {
  const n = typeof drops === "string" ? Number(drops) : drops;
  if (Number.isNaN(n)) return 0;
  return n / DROPS_PER_XRP;
}

export function xrpToDrops(xrp: number): string {
  return Math.floor(xrp * DROPS_PER_XRP).toString();
}

export function formatXrp(xrp: number | string, decimals = 6): string {
  const n = typeof xrp === "string" ? Number(xrp) : xrp;
  if (Number.isNaN(n)) return "0";
  return n.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

/** Convert an XRPL hex currency code (40 chars) to a printable label. */
export function decodeCurrency(code: string): string {
  if (!code) return "";
  if (code === "XRP") return "XRP";
  if (code.length === 3) return code;
  if (code.length === 40) {
    try {
      const trimmed = code.replace(/0+$/, "");
      const bytes = trimmed.match(/.{1,2}/g) ?? [];
      const decoded = bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join("");
      return decoded.replace(/\u0000+$/, "") || code;
    } catch {
      return code;
    }
  }
  return code;
}
