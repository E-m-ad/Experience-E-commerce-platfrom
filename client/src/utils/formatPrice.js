export const formatPrice = (amount, currency = "EGP") =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const discountPercent = (original, compare) =>
  compare ? Math.round(((compare - original) / compare) * 100) : 0;
