'use client';
import React, { useState } from 'react';

const mockAlerts = [
  { id: 1, type: 'Stalled', quote: 'QUO-991', severity: 'High', message: 'Quote inactive for 8 days', rep: 'John Doe' },
  { id: 2, type: 'Discount Anomaly', quote: 'QUO-992', severity: 'Medium', message: 'Discount is 22% (historical avg is 8%)', rep: 'Jane Smith' },
  { id: 3, type: 'Delivery Slippage', quote: 'ORD-1042', severity: 'High', message: 'Promised date earlier than estimated fulfillment', rep: 'Bob Lee' }
];

export default function DealHealthPage() {
  const [alerts, setAlerts] = useState(mockAlerts);

  const handleAction = (id, action) => {
    setAlerts(alerts.filter(a => a.id !== id));
    alert(action + ' applied to alert ' + id);
  };

  return (
    <div className='p-8 max-w-6xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Deal Health & Anomaly Dashboard</h1>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
        <div className='bg-red-50 border border-red-200 p-4 rounded-lg'>
          <h2 className='text-red-800 font-bold'>Stalled Deals</h2>
          <p className='text-2xl text-red-600 font-bold'>1</p>
        </div>
        <div className='bg-yellow-50 border border-yellow-200 p-4 rounded-lg'>
          <h2 className='text-yellow-800 font-bold'>Discount Anomalies</h2>
          <p className='text-2xl text-yellow-600 font-bold'>1</p>
        </div>
        <div className='bg-orange-50 border border-orange-200 p-4 rounded-lg'>
          <h2 className='text-orange-800 font-bold'>Delivery Slippages</h2>
          <p className='text-2xl text-orange-600 font-bold'>1</p>
        </div>
      </div>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <h2 className='text-lg font-semibold mb-4'>Active Alerts</h2>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Type</th>
              <th className='pb-2'>Quote / Order</th>
              <th className='pb-2'>Rep</th>
              <th className='pb-2'>Details</th>
              <th className='pb-2'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id} className='border-b'>
                <td className='py-3 font-medium'>{a.type}</td>
                <td className='py-3 text-blue-600 hover:underline cursor-pointer'>{a.quote}</td>
                <td className='py-3'>{a.rep}</td>
                <td className='py-3 text-gray-600'>{a.message}</td>
                <td className='py-3 space-x-2'>
                  <button onClick={() => handleAction(a.id, 'Nudged rep')} className='px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200'>Nudge Rep</button>
                  <button onClick={() => handleAction(a.id, 'Escalated')} className='px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200'>Escalate</button>
                </td>
              </tr>
            ))}
            {alerts.length === 0 && <tr><td colSpan='5' className='py-4 text-center text-gray-500'>No active alerts!</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
