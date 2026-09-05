'use client';
import React, { useState } from 'react';

const mockInvoices = [
  { id: 'INV-1001', customer: 'Acme Corp', amount: 1500.00, status: 'Unpaid', dueDate: '2026-09-30' },
  { id: 'INV-1002', customer: 'Beta Industries', amount: 300.00, status: 'Partially Paid', dueDate: '2026-09-15' },
  { id: 'INV-1003', customer: 'Gamma LLC', amount: 4500.00, status: 'Paid', dueDate: '2026-09-01' }
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState(mockInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const handleRecordPayment = (id) => {
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status: 'Paid' } : inv));
    setSelectedInvoice(null);
  };

  return (
    <div className='p-8 max-w-6xl mx-auto'>
      <h1 className='text-2xl font-bold mb-6'>Invoices</h1>
      <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
        <table className='w-full text-left text-sm'>
          <thead>
            <tr className='border-b text-gray-600'>
              <th className='pb-2'>Invoice No</th>
              <th className='pb-2'>Customer</th>
              <th className='pb-2'>Amount</th>
              <th className='pb-2'>Due Date</th>
              <th className='pb-2'>Status</th>
              <th className='pb-2'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} className='border-b'>
                <td className='py-3 font-medium'>{inv.id}</td>
                <td className='py-3'>{inv.customer}</td>
                <td className='py-3'>$</td>
                <td className='py-3'>{inv.dueDate}</td>
                <td className='py-3'>
                  <span className={px-2 py-1 rounded text-xs  + 
                    (inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                     inv.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800')}>
                    {inv.status}
                  </span>
                </td>
                <td className='py-3'>
                  {inv.status !== 'Paid' && (
                    <button onClick={() => setSelectedInvoice(inv.id)} className='text-blue-600 hover:underline'>Record Payment</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInvoice && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center'>
          <div className='bg-white p-6 rounded-lg shadow-lg w-96'>
            <h2 className='text-xl font-bold mb-4'>Record Payment for {selectedInvoice}</h2>
            <div className='mb-4'>
              <label className='block text-sm font-medium mb-1'>Payment Amount</label>
              <input type='number' className='w-full border rounded px-3 py-2' placeholder='Amount' />
            </div>
            <div className='flex justify-end gap-3'>
              <button onClick={() => setSelectedInvoice(null)} className='px-4 py-2 text-gray-600 hover:bg-gray-100 rounded'>Cancel</button>
              <button onClick={() => handleRecordPayment(selectedInvoice)} className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'>Confirm Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
