'use client';
import React from 'react';

export default function CreditNotesPage() {
  return (
    <div className='p-8 max-w-5xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Credit Notes</h1>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Credit Note ID</th>
              <th className='pb-2'>Customer</th>
              <th className='pb-2'>Amount</th>
              <th className='pb-2'>Reason</th>
              <th className='pb-2'>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-b'>
              <td className='py-3 font-medium'>CN-5001</td>
              <td className='py-3'>Beta Industries</td>
              <td className='py-3 text-green-600 font-bold'>$75.00</td>
              <td className='py-3'>Mid-cycle subscription downgrade (ORD-2099)</td>
              <td className='py-3'><span className='bg-green-100 text-green-800 px-2 py-1 rounded text-xs'>Applied</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
