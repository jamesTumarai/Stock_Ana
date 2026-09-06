import React, { useState, useEffect, useMemo } from 'react';

interface CompanyLogoProps {
  ticker?: string;
  website?: string;
  className?: string;
  imgClassName?: string;
  alt?: string;
}

// Curated accurate logos for cryptos, ambiguous symbols, and special tickers
const KNOWN_BRAND_LOGOS: Record<string, string> = {
  // Major Cryptocurrencies (Official high-res icons - prevents clashing with legacy stock tickers)
  'BTC': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
  'BTC-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
  'BTCUSD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
  'BITCOIN': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/btc.png',
  'ETH': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
  'ETH-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
  'ETHUSD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png',
  'SOL': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png',
  'SOL-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/sol.png',
  'XRP': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xrp.png',
  'XRP-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xrp.png',
  'DOGE': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/doge.png',
  'DOGE-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/doge.png',
  'BNB': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png',
  'BNB-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/bnb.png',
  'ADA': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ada.png',
  'ADA-USD': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ada.png',
  'AVAX': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/avax.png',
  'DOT': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/dot.png',
  'LINK': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/link.png',
  'UNI': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/uni.png',
  'LTC': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/ltc.png',
  'ATOM': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/atom.png',
  'XLM': 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/xlm.png',

  // SpaceX (SPCX / pre-IPO SpaceX tracking)
  'SPCX': 'https://cdn.jsdelivr.net/npm/simple-icons@v14/icons/spacex.svg',
};

// Color palettes for fallback badge based on ticker name
const FALLBACK_PALETTES = [
  'bg-blue-50 text-blue-700 border-blue-200/80',
  'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  'bg-violet-50 text-violet-700 border-violet-200/80',
  'bg-amber-50 text-amber-700 border-amber-200/80',
  'bg-rose-50 text-rose-700 border-rose-200/80',
  'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  'bg-cyan-50 text-cyan-700 border-cyan-200/80',
];

export function CompanyLogo({ 
  ticker = '', 
  website,
  className = 'w-10 h-10',
  imgClassName,
  alt 
}: CompanyLogoProps) {
  const cleanTicker = (ticker || '').trim().toUpperCase();
  const [sourceIndex, setSourceIndex] = useState(0);

  // Build intelligent waterfall of logo sources
  const sources = useMemo(() => {
    const list: string[] = [];

    // 1. Direct curated override (Cryptos, SpaceX, etc.)
    if (cleanTicker && KNOWN_BRAND_LOGOS[cleanTicker]) {
      list.push(KNOWN_BRAND_LOGOS[cleanTicker]);
    }

    // 2. Official Website domain favicon (if provided)
    if (website) {
      try {
        const cleanDomain = website.replace(/^https?:\/\//i, '').split('/')[0];
        if (cleanDomain) {
          list.push(`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`);
        }
      } catch {
        // ignore invalid domain
      }
    }

    // 3. Parqet Vector SVG repository (original ticker)
    if (cleanTicker) {
      list.push(`https://assets.parqet.com/logos/symbol/${cleanTicker}`);
    }

    // 4. Dot/Dash alternate normalization (e.g. BRK.B <-> BRK-B)
    if (cleanTicker.includes('.')) {
      list.push(`https://assets.parqet.com/logos/symbol/${cleanTicker.replace(/\./g, '-')}`);
      list.push(`https://financialmodelingprep.com/image-stock/${cleanTicker.replace(/\./g, '-')}.png`);
    } else if (cleanTicker.includes('-')) {
      list.push(`https://assets.parqet.com/logos/symbol/${cleanTicker.replace(/-/g, '.')}`);
      list.push(`https://financialmodelingprep.com/image-stock/${cleanTicker.replace(/-/g, '.')}.png`);
    }

    // 5. Thai SET Stock fallback (e.g. PTT -> PTT.BK, DELTA -> DELTA.BK)
    if (!cleanTicker.includes('.')) {
      list.push(`https://assets.parqet.com/logos/symbol/${cleanTicker}.BK`);
      list.push(`https://financialmodelingprep.com/image-stock/${cleanTicker}.BK.png`);
    }

    // 6. Financial Modeling Prep global stock image repository
    if (cleanTicker) {
      list.push(`https://financialmodelingprep.com/image-stock/${cleanTicker}.png`);
    }

    return list;
  }, [cleanTicker, website]);

  // Reset source if ticker or website changes
  useEffect(() => {
    setSourceIndex(0);
  }, [cleanTicker, website]);

  const handleImageError = () => {
    setSourceIndex(prev => prev + 1);
  };

  // Monogram fallback if all sources fail
  if (!cleanTicker || sourceIndex >= sources.length) {
    const hash = cleanTicker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const palette = FALLBACK_PALETTES[hash % FALLBACK_PALETTES.length];
    const initials = cleanTicker.replace(/[^A-Z0-9]/g, '').slice(0, 2) || cleanTicker.slice(0, 2) || '??';

    return (
      <div 
        className={`${className} aspect-square rounded-xl border flex items-center justify-center font-mono font-bold text-xs tracking-tight shrink-0 select-none shadow-2xs ${palette}`}
        title={cleanTicker}
      >
        {initials}
      </div>
    );
  }

  return (
    <div 
      className={`${className} aspect-square rounded-xl border border-stone-200/80 bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs select-none`}
      title={cleanTicker}
    >
      <img
        src={sources[sourceIndex]}
        alt={alt || `${cleanTicker} logo`}
        loading="lazy"
        onError={handleImageError}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain'
        }}
        className={`block select-none pointer-events-none rounded-lg ${imgClassName || ''}`}
      />
    </div>
  );
}

