// Shared money/price formatting. Kept sign-aware so metrics like
// "Best Trade" can never render as "+$-40.00".

/** Plain number string with adaptive precision. Returns "—" for bad input. */
export function formatPrice(val) {
  if (val == null || isNaN(val)) return "—";
  try {
    if (val >= 1000) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    if (val >= 1) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (val >= 0.01) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    }
    return val.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  } catch {
    return String(val);
  }
}

/** USD with a "$" prefix; passes "—" through untouched. */
export function usd(val) {
  const s = formatPrice(val);
  return s === "—" ? s : `$${s}`;
}

export function formatMyr(val) {
  if (val == null || isNaN(val)) return "—";
  try {
    return "RM" + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    return `RM${val.toFixed(2)}`;
  }
}

/**
 * Sign-aware money: fmtMoney(-40)      -> "-$40.00"
 *                   fmtMoney(40, {signed:true}) -> "+$40.00"
 *                   fmtMoney(0, {signed:true})  -> "$0.00"
 */
export function fmtMoney(val, { signed = false } = {}) {
  if (val == null || isNaN(val)) return "—";
  const abs = Math.abs(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (val < 0) return `-$${abs}`;
  return signed ? `+$${abs}` : `$${abs}`;
}
