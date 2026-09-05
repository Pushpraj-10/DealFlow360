'use client';
import React from 'react';

const mockInventory = [
  { sku: 'HW-SRV-01', product: 'Enterprise Server Rack', onHand: 50, reserved: 10, available: 40, warehouse: 'Main Warehouse' },
  { sku: 'HW-SWT-48', product: 'Networking Switch 48-port', onHand: 15, reserved: 20, available: -5, warehouse: 'East Depot' }
];

export default function InventoryPage() {
  return (
    <div className='p-8 max-w-6xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Inventory Management</h1>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>SKU</th>
              <th className='pb-2'>Product</th>
              <th className='pb-2'>Warehouse</th>
              <th className='pb-2'>On Hand</th>
              <th className='pb-2'>Reserved</th>
              <th className='pb-2'>Available</th>
            </tr>
          </thead>
          <tbody>
            {mockInventory.map(inv => (
              <tr key={inv.sku + inv.warehouse} className='border-b'>
                <td className='py-3 font-medium'>{inv.sku}</td>
                <td className='py-3'>{inv.product}</td>
                <td className='py-3'>{inv.warehouse}</td>
                <td className='py-3'>{inv.onHand}</td>
                <td className='py-3'>{inv.reserved}</td>
                <td className={py-3 font-bold  + (inv.available < 0 ? 'text-red-600' : 'text-green-600')}>{inv.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
