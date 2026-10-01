/** Reject currency-ambiguous amounts rather than silently converting a filed
 * EUR/CAD/etc. disclosure into the USD canonical dataset. */
export const explicitlyUsdMillions=(text:string)=>/(?:in millions|\$\s*millions)/i.test(text)&&/(?:\bUSD\b|\bUS dollars\b|U\.S\. dollars|\$)/i.test(text)&&!/\b(?:EUR|GBP|JPY|CNY|RMB|CAD|AUD)\b/.test(text);
