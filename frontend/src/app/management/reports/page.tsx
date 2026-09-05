'use client';
import React from 'react';

export default function ReportsPage() {
  return (
    <div className='p-8 max-w-6xl mx-auto'>
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-2xl font-bold'>Reports & Analytics</h1>
        <button className='px-4 py-2 bg-gray-800 text-white rounded shadow text-sm'>Export PDF/XLS</button>
      </div>
      <div className='flex gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200'>
        <select className='border rounded px-3 py-2 text-sm'><option>Period: This Month</option></select>
        <select className='border rounded px-3 py-2 text-sm'><option>Sales Team: All</option></select>
        <select className='border rounded px-3 py-2 text-sm'><option>Status: Approved</option></select>
      </div>
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-sm text-gray-500 mb-1'>Quotes Created</h3>
          <p className='text-3xl font-bold text-gray-900'>124</p>
        </div>
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-sm text-gray-500 mb-1'>Avg Approval Time</h3>
          <p className='text-3xl font-bold text-gray-900'>4.2 hrs</p>
        </div>
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-sm text-gray-500 mb-1'>Recurring Revenue</h3>
          <p className='text-3xl font-bold text-gray-900'>$12.5k</p>
        </div>
        <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
          <h3 className='text-sm text-gray-500 mb-1'>Top Upsell</h3>
          <p className='text-xl font-bold text-gray-900 mt-2'>Premium Support SLA</p>
        </div>
      </div>
    </div>
  );
}
