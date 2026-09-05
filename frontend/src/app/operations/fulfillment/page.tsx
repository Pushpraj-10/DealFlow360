'use client';

import React, { useState } from 'react';

// Mock data based on the PRD for demonstration
const mockOrder = {
  id: 'ORD-1042',
  customer: 'Acme Corp',
  status: 'Pending Fulfillment',
  lines: [
    { id: 'L1', product: 'Enterprise Server Rack', requestedQty: 10, fulfilledQty: 0, backorderQty: 0 },
    { id: 'L2', product: 'Networking Switch 48-port', requestedQty: 25, fulfilledQty: 0, backorderQty: 0 }
  ]
};

const mockSuggestedSplit = [
  { warehouse: 'Main Warehouse', product: 'Enterprise Server Rack', qty: 10, estCost: 150.00 },
  { warehouse: 'Main Warehouse', product: 'Networking Switch 48-port', qty: 20, estCost: 50.00 },
  { warehouse: 'East Depot', product: 'Networking Switch 48-port', qty: 5, estCost: 25.00 }
];

export default function FulfillmentPage() {
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [status, setStatus] = useState('Pending');

  const handleAcceptSplit = () => {
    setStatus('Split Accepted & Reserved');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fulfillment & Warehouse Split</h1>
        <span className={`px-4 py-1 rounded-full text-sm font-medium ${status === 'Pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
          {status}
        </span>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Order {mockOrder.id} - {mockOrder.customer}</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b text-gray-600 text-sm">
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium">Requested Qty</th>
              <th className="pb-2 font-medium">Fulfilled Qty</th>
              <th className="pb-2 font-medium">Backorder Qty</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {mockOrder.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="py-3">{line.product}</td>
                <td className="py-3">{line.requestedQty}</td>
                <td className="py-3">{line.fulfilledQty}</td>
                <td className="py-3 text-red-500">{line.backorderQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">System Suggested Split</h2>
          {!isOverrideMode && status === 'Pending' && (
            <button 
              onClick={() => setIsOverrideMode(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Manual Override
            </button>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Recommendation rationale:</strong> Minimized shipping shipments across 2 warehouses. Lowest estimated cost to fulfill available stock.
          </p>
        </div>

        <table className="w-full text-left border-collapse mb-6">
          <thead>
            <tr className="border-b text-gray-600 text-sm">
              <th className="pb-2 font-medium">Warehouse</th>
              <th className="pb-2 font-medium">Product</th>
              <th className="pb-2 font-medium">Allocated Qty</th>
              <th className="pb-2 font-medium">Est. Shipping Cost</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {mockSuggestedSplit.map((split, idx) => (
              <tr key={idx} className="border-b last:border-0">
                <td className="py-3 font-medium">{split.warehouse}</td>
                <td className="py-3">{split.product}</td>
                <td className="py-3">
                  {isOverrideMode ? (
                    <input type="number" defaultValue={split.qty} className="border rounded px-2 py-1 w-20" />
                  ) : (
                    split.qty
                  )}
                </td>
                <td className="py-3">${split.estCost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {status === 'Pending' && (
          <div className="flex gap-4">
            {isOverrideMode ? (
              <>
                <button 
                  onClick={() => { setStatus('Manual Override Applied'); setIsOverrideMode(false); }}
                  className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700"
                >
                  Save Override
                </button>
                <button 
                  onClick={() => setIsOverrideMode(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button 
                onClick={handleAcceptSplit}
                className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
              >
                Accept Suggested Split
              </button>
            )}
          </div>
        )}

      </div>
      
      {/* Backorder Consolidate Prompt Simulation */}
      {status !== 'Pending' && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-yellow-800">Consolidate Remaining Backorder</h3>
            <p className="text-sm text-yellow-700">New stock arrived at East Depot for pending backorders on ORD-1042.</p>
          </div>
          <button className="bg-yellow-600 text-white px-4 py-2 rounded text-sm hover:bg-yellow-700 shadow-sm">
            Review Consolidation
          </button>
        </div>
      )}
    </div>
  );
}
