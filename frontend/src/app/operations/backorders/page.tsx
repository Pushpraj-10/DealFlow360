'use client';
import React from 'react';

export default function BackordersPage() {
  return (
    <div className='p-8 max-w-5xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Backorders Management</h1>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Order No</th>
              <th className='pb-2'>Product</th>
              <th className='pb-2'>Shortage Qty</th>
              <th className='pb-2'>Status</th>
              <th className='pb-2'>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-b'>
              <td className='py-3 font-medium text-blue-600'>ORD-1042</td>
              <td className='py-3'>Networking Switch 48-port</td>
              <td className='py-3 text-red-600 font-bold'>5</td>
              <td className='py-3'>Pending Restock</td>
              <td className='py-3'><button className='text-gray-400 cursor-not-allowed' disabled>Consolidate</button></td>
            </tr>
            <tr className='border-b'>
              <td className='py-3 font-medium text-blue-600'>ORD-0988</td>
              <td className='py-3'>Enterprise Server Rack</td>
              <td className='py-3 text-red-600 font-bold'>2</td>
              <td className='py-3 text-yellow-600'>Stock Available</td>
              <td className='py-3'><button className='bg-yellow-100 text-yellow-800 px-3 py-1 rounded hover:bg-yellow-200'>Consolidate Now</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
