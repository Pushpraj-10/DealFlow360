'use client';

import React, { useState } from 'react';

// Mock data based on the PRD
const mockSubscriptionOrder = {
  id: 'ORD-2099',
  customer: 'Beta Industries',
  status: 'Active',
  oneTimeLines: [
    { id: 'L1', product: 'Hardware Router X1', qty: 2, price: 500.00, invoiced: true }
  ],
  recurringLines: [
    { 
      id: 'S1', 
      product: 'Premium Support SLA', 
      plan: 'Monthly', 
      qty: 2, 
      unitPrice: 150.00, 
      nextBillDate: '2026-10-01',
      status: 'Active'
    }
  ]
};

export default function SubscriptionsPage() {
  const [selectedSub, setSelectedSub] = useState(mockSubscriptionOrder.recurringLines[0]);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyQty, setModifyQty] = useState(selectedSub.qty);

  const calculateProration = (oldQty: number, newQty: number) => {
    // Mock 15 days remaining in a 30 day month
    const remainingFraction = 15 / 30;
    const oldTotal = oldQty * selectedSub.unitPrice;
    const newTotal = newQty * selectedSub.unitPrice;
    const delta = (newTotal - oldTotal) * remainingFraction;
    return delta;
  };

  const prorationDelta = calculateProration(selectedSub.qty, modifyQty);

  const handleConfirmModify = () => {
    setSelectedSub({ ...selectedSub, qty: modifyQty });
    setShowModifyModal(false);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions & Billing</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Order {mockSubscriptionOrder.id} - {mockSubscriptionOrder.customer}</h2>
        
        <div className="mb-6">
          <h3 className="text-sm uppercase text-gray-500 font-bold mb-3 border-b pb-2">One-Time Lines</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="pb-2">Product</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Total Price</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockSubscriptionOrder.oneTimeLines.map(line => (
                <tr key={line.id} className="border-t">
                  <td className="py-2">{line.product}</td>
                  <td className="py-2">{line.qty}</td>
                  <td className="py-2">${(line.qty * line.price).toFixed(2)}</td>
                  <td className="py-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{line.invoiced ? 'Invoiced' : 'Pending'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-sm uppercase text-gray-500 font-bold mb-3 border-b pb-2">Recurring Subscriptions</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-600">
                <th className="pb-2">Plan / Product</th>
                <th className="pb-2">Cycle</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Unit Price</th>
                <th className="pb-2">Next Bill Date</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-3 font-medium text-blue-600">{selectedSub.product}</td>
                <td className="py-3">{selectedSub.plan}</td>
                <td className="py-3">{selectedSub.qty}</td>
                <td className="py-3">${selectedSub.unitPrice.toFixed(2)}</td>
                <td className="py-3">{selectedSub.nextBillDate}</td>
                <td className="py-3">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">{selectedSub.status}</span>
                </td>
                <td className="py-3 text-right space-x-2">
                  <button 
                    onClick={() => setShowModifyModal(true)}
                    className="text-blue-600 hover:underline"
                  >
                    Modify
                  </button>
                  <button className="text-red-600 hover:underline">Cancel</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {showModifyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Modify Subscription</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
              <input 
                type="number" 
                value={modifyQty} 
                onChange={(e) => setModifyQty(parseInt(e.target.value) || 0)}
                className="w-full border rounded px-3 py-2"
                min="1"
              />
            </div>
            
            <div className="bg-gray-50 p-3 rounded text-sm mb-6 border border-gray-200">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Remaining Days in Cycle:</span>
                <span className="font-medium">15</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Prorated {prorationDelta >= 0 ? 'Charge' : 'Credit'}:</span>
                <span className={`font-medium ${prorationDelta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${Math.abs(prorationDelta).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This amount will be applied to the next invoice immediately based on the mid-cycle proration policy.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowModifyModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Close
              </button>
              <button 
                onClick={handleConfirmModify}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Confirm Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
