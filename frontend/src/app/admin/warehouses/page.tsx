'use client';
import React from 'react';

export default function WarehousesPage() {
  return (
    <div className='p-8 max-w-4xl mx-auto'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Warehouse Setup</h1>
        <button className='bg-blue-600 text-white px-4 py-2 rounded shadow text-sm'>+ Add Warehouse</button>
      </div>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Warehouse Name</th>
              <th className='pb-2'>Location</th>
              <th className='pb-2'>Shipping Cost Weight</th>
              <th className='pb-2'>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr className='border-b'>
              <td className='py-3 font-medium'>Main Warehouse</td>
              <td className='py-3'>Central Hub</td>
              <td className='py-3'>1.0x (Default)</td>
              <td className='py-3 text-green-600'>Active</td>
            </tr>
            <tr className='border-b'>
              <td className='py-3 font-medium'>East Depot</td>
              <td className='py-3'>East Coast</td>
              <td className='py-3'>1.5x (Premium)</td>
              <td className='py-3 text-green-600'>Active</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
