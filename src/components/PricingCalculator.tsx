// components/PricingCalculator.tsx - Reusable pricing calculator component
'use client';

import { useState } from 'react';

type PricingData = {
  min: number | null;
  median: number | null;
  max: number | null;
  count: number;
  suggested: number | null;
};

type Props = {
  albumId: number;
  discogsReleaseId: string | null;
  currentPrice: number | null;
  wholesaleCost: number | null;
  onApplyPrice: (price: number) => void;
  onSaveWholesaleCost?: (cost: number) => void;
};

export default function PricingCalculator({
  discogsReleaseId,
  currentPrice,
  wholesaleCost: initialWholesaleCost,
  onApplyPrice,
  onSaveWholesaleCost
}: Props) {
  const [loading, setLoading] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [wholesaleCost, setWholesaleCost] = useState(initialWholesaleCost?.toString() || '');
  const [error, setError] = useState('');

  const fetchDiscogsPrices = async () => {
    if (!discogsReleaseId) {
      setError('No Discogs Release ID available');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/pricing/discogs-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: discogsReleaseId })
      });

      const result = await res.json();

      if (result.success) {
        setPricingData(result.data.prices);
      } else {
        setError(result.error || 'Failed to fetch pricing');
      }
    } catch {
      setError('Network error fetching prices');
    } finally {
      setLoading(false);
    }
  };

  const calculateMarkup = (cost: number, markupPercent: number = 40) => {
    return cost / (1 - markupPercent / 100);
  };

  const wholesalePrice = wholesaleCost ? parseFloat(wholesaleCost) : null;
  const markupPrice = wholesalePrice ? calculateMarkup(wholesalePrice, 40) : null;

  // Determine recommended price
  let recommendedPrice: number | null = null;
  let recommendedReason = '';

  if (pricingData?.suggested && markupPrice) {
    // Use the lower of: competitive Discogs price OR markup price
    recommendedPrice = Math.min(pricingData.suggested, markupPrice);
    recommendedReason = recommendedPrice === markupPrice 
      ? '40% markup from wholesale'
      : 'Competitive with Discogs market';
  } else if (pricingData?.suggested) {
    recommendedPrice = pricingData.suggested;
    recommendedReason = 'Based on Discogs market data';
  } else if (markupPrice) {
    recommendedPrice = markupPrice;
    recommendedReason = '40% profit margin from wholesale';
  }

  return (
    <div style={{
      border: '2px solid #8b5cf6',
      borderRadius: 12,
      padding: 20,
      background: 'linear-gradient(to bottom, #faf5ff, white)'
    }}>
      <h3 style={{
        fontSize: 18,
        fontWeight: 'bold',
        color: '#7c3aed',
        margin: '0 0 16px 0'
      }}>
        💰 Pricing Calculator
      </h3>

      {/* Wholesale Cost Input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: 'block',
          fontSize: 14,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 6
        }}>
          Wholesale Cost (Optional)
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            value={wholesaleCost}
            onChange={e => setWholesaleCost(e.target.value)}
            placeholder="0.00"
            step="0.01"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14
            }}
          />
          {onSaveWholesaleCost && wholesaleCost && (
            <button
              onClick={() => onSaveWholesaleCost(parseFloat(wholesaleCost))}
              style={{
                padding: '8px 16px',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Save Cost
            </button>
          )}
        </div>
        {markupPrice && (
          <div style={{
            marginTop: 8,
            fontSize: 13,
            color: '#6b7280'
          }}>
            40% markup = <strong style={{ color: '#7c3aed' }}>${markupPrice.toFixed(2)}</strong>
            {' '}(${wholesalePrice!.toFixed(2)} cost + ${(markupPrice - wholesalePrice!).toFixed(2)} profit)
          </div>
        )}
      </div>

      {/* Discogs Pricing */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12
        }}>
          <label style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#374151'
          }}>
            Discogs Market Prices
          </label>
          <button
            onClick={fetchDiscogsPrices}
            disabled={loading || !discogsReleaseId}
            style={{
              padding: '6px 12px',
              background: loading ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: loading || !discogsReleaseId ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Loading...' : '🔄 Fetch Prices'}
          </button>
        </div>

        {error && (
          <div style={{
            padding: 12,
            background: '#fee2e2',
            border: '1px solid #dc2626',
            borderRadius: 6,
            fontSize: 13,
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}

        {pricingData && (
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #3b82f6',
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 12
            }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Min</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0c4a6e' }}>
                  {pricingData.min ? `$${pricingData.min.toFixed(2)}` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Median</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0c4a6e' }}>
                  {pricingData.median ? `$${pricingData.median.toFixed(2)}` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Max</div>
                <div style={{ fontSize: 18, fontWeight: 'bold', color: '#0c4a6e' }}>
                  {pricingData.max ? `$${pricingData.max.toFixed(2)}` : '—'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              Based on {pricingData.count} current listings
            </div>
          </div>
        )}
      </div>

      {/* Recommended Price */}
      {recommendedPrice && (
        <div style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: '2px solid #10b981',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
                💡 Recommended Price
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: 'white' }}>
                ${recommendedPrice.toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                {recommendedReason}
              </div>
            </div>
            <button
              onClick={() => onApplyPrice(recommendedPrice)}
              style={{
                padding: '10px 20px',
                background: 'white',
                color: '#059669',
                border: 'none',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Apply Price →
            </button>
          </div>
        </div>
      )}

      {/* Current Price Display */}
      {currentPrice && (
        <div style={{
          padding: 12,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 13,
          color: '#6b7280',
          textAlign: 'center'
        }}>
          Current sale price: <strong>${currentPrice.toFixed(2)}</strong>
          {recommendedPrice && currentPrice !== recommendedPrice && (
            <span style={{ color: currentPrice < recommendedPrice ? '#dc2626' : '#059669', marginLeft: 8 }}>
              ({currentPrice < recommendedPrice ? '↓' : '↑'} ${Math.abs(recommendedPrice - currentPrice).toFixed(2)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}