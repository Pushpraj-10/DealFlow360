'use client';

import React, { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Plus, TrendingUp, Loader } from 'lucide-react';
import { money } from '@/lib/salesRep';

type RecommendationProduct = {
  id: string;
  name: string;
  productType: string;
  billingType: string;
  unit?: string;
};

type Recommendation = {
  product: RecommendationProduct;
  matchedSourceProductIds: string[];
  ruleIds: string[];
  coPurchaseScore: number;
  promotionBoost: number;
  rankScore: number;
  minimumRequiredMarginPercent: number;
  expectedRevenue: number;
  estimatedMarginDelta: number;
  estimatedMarginPercent: number;
  pricingSource: string;
};

type RecommendationsData = {
  quotationId: string;
  currencyCode: string;
  recommendations: Recommendation[];
};

type RecommendationsPanelProps = {
  quotationId: string;
  onRecommendationAdded: () => void;
};

export function RecommendationsPanel({ quotationId, onRecommendationAdded }: RecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<RecommendationsData>(`/recommendations/quotations/${quotationId}/upsells`);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load recommendations');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quotationId) {
      loadRecommendations();
    }
  }, [quotationId]);

  const handleAddRecommendation = async (productId: string) => {
    setAddingProductId(productId);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await api.post(`/recommendations/quotations/${quotationId}/upsells`, {
        productId,
        quantity: 1
      });
      
      // Show success message
      const addedProduct = recommendations.find(r => r.product.id === productId);
      setSuccessMessage(addedProduct ? `${addedProduct.product.name} added to quotation` : 'Product added');
      
      // Refresh recommendations and notify parent
      await loadRecommendations();
      onRecommendationAdded();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to add recommendation');
      }
    } finally {
      setAddingProductId(null);
    }
  };

  if (loading) {
    return (
      <div className="recommendations-panel">
        <div className="recommendations-header">
          <h3 className="quotation-section-title">Recommended for this deal</h3>
        </div>
        <div className="recommendations-loading">
          <Loader size={18} className="spinner" />
          <span>Loading recommendations...</span>
        </div>
      </div>
    );
  }

  if (error && recommendations.length === 0) {
    return null; // Silently hide if there's an error loading
  }

  if (recommendations.length === 0) {
    return null; // Don't show if no recommendations
  }

  return (
    <div className="recommendations-panel">
      <div className="recommendations-header">
        <div>
          <h3 className="quotation-section-title">Recommended for this deal</h3>
          <p className="recommendations-subtitle">Based on this quotation's products and customer profile</p>
        </div>
      </div>

      {successMessage && (
        <div className="df-alert df-alert-success" style={{ marginBottom: '12px', fontSize: '12px', padding: '8px 12px' }}>
          {successMessage}
        </div>
      )}

      {error && (
        <div className="df-alert df-alert-error" style={{ marginBottom: '12px', fontSize: '12px', padding: '8px 12px' }}>
          {error}
        </div>
      )}

      <div className="recommendations-list">
        {recommendations.map((rec) => {
          const isAdding = addingProductId === rec.product.id;
          const isRecurring = rec.product.billingType === 'RECURRING' || rec.product.billingType === 'SUBSCRIPTION';
          
          return (
            <div key={rec.product.id} className="recommendation-item">
              <div className="recommendation-content">
                <div className="recommendation-main">
                  <span className="recommendation-product-name">{rec.product.name}</span>
                  {isRecurring && (
                    <span className="recommendation-billing-type">
                      {rec.product.billingType === 'SUBSCRIPTION' ? 'Subscription' : 'Recurring'}
                    </span>
                  )}
                </div>
                
                <div className="recommendation-metrics">
                  <div className="recommendation-metric">
                    <span className="metric-value">{money(rec.expectedRevenue)}</span>
                    <span className="metric-label">
                      {isRecurring ? '/ month revenue' : 'revenue'}
                    </span>
                  </div>
                  
                  <div className="recommendation-metric">
                    <TrendingUp size={12} style={{ color: 'var(--green)' }} />
                    <span className="metric-value">{money(rec.estimatedMarginDelta)}</span>
                    <span className="metric-label">est. margin</span>
                  </div>
                  
                  <div className="recommendation-metric">
                    <span className="metric-value">{rec.estimatedMarginPercent.toFixed(0)}%</span>
                    <span className="metric-label">margin</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => handleAddRecommendation(rec.product.id)}
                disabled={isAdding}
                className="btn btn-primary btn-sm"
                style={{ minWidth: '110px' }}
              >
                {isAdding ? (
                  <>
                    <Loader size={12} className="spinner" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Add to quote
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .recommendations-panel {
          background: var(--surface-01);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 16px 18px;
          margin-top: 20px;
        }

        .recommendations-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .recommendations-subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }

        .recommendations-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 0;
          color: var(--text-secondary);
          font-size: 13px;
        }

        .recommendations-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .recommendation-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          background: var(--surface-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .recommendation-item:hover {
          border-color: var(--border-strong);
          box-shadow: var(--shadow-sm);
        }

        .recommendation-content {
          flex: 1;
          min-width: 0;
        }

        .recommendation-main {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .recommendation-product-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .recommendation-billing-type {
          font-size: 10px;
          font-weight: 600;
          color: var(--accent);
          background: var(--accent-light);
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .recommendation-metrics {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .recommendation-metric {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
        }

        .recommendation-metric .metric-value {
          font-weight: 600;
          color: var(--text-primary);
        }

        .recommendation-metric .metric-label {
          color: var(--text-secondary);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
