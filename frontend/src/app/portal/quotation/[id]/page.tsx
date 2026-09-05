'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api';

type PortalQuotation = {
  id: string;
  quoteNumber: string;
  status: string;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
};

export default function PortalQuotationPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<PortalQuotation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ quotation: PortalQuotation }>(`/quotations/portal/${params.id}`)
      .then((d) => setQuotation(d.quotation))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : 'Failed to load quotation'));
  }, [params.id]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Customer Portal - Quotation</h1>

      {error && <div className="mb-4 px-3 py-2 bg-red-50 text-red-700 text-sm rounded border border-red-200">{error}</div>}

      {quotation && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">{quotation.quoteNumber}</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium">{quotation.status}</dd>
            <dt className="text-gray-500">Currency</dt>
            <dd>{quotation.currencyCode}</dd>
            <dt className="text-gray-500">Created</dt>
            <dd>{new Date(quotation.createdAt).toLocaleString()}</dd>
            <dt className="text-gray-500">Last Updated</dt>
            <dd>{new Date(quotation.updatedAt).toLocaleString()}</dd>
          </dl>
          <p className="text-xs text-gray-400 mt-6">
            Line-level comments, counter-discount proposals, and one-click confirmation are part of the negotiation
            module, which is currently a backend stub (see System Status).
          </p>
        </div>
      )}
    </div>
  );
}
