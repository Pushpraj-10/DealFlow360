'use client';
import React from 'react';

export default function SubscriptionPlansPage() {
  return (
    <div className='p-8 max-w-4xl mx-auto'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Subscription Plans Setup</h1>
        <button className='bg-blue-600 text-white px-4 py-2 rounded shadow text-sm'>+ New Plan</button>
      </div>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Plan Name</th>
              <th className='pb-2'>Cycle</th>
              <th className='pb-2'>Proration Policy</th>
              <th className='pb-2'>Cancellation Policy</th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-b'>
              <td className='py-3 font-medium'>Premium Support SLA</td>
              <td className='py-3'>Monthly</td>
              <td className='py-3'>Exact Days</td>
              <td className='py-3'>Prorated Refund</td>
            </tr>
            <tr className='border-b'>
              <td className='py-3 font-medium'>Enterprise Software License</td>
              <td className='py-3'>Yearly</td>
              <td className='py-3'>Monthly Increments</td>
              <td className='py-3'>No Refund</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
