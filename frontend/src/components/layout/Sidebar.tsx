import Link from 'next/link';

export function Sidebar() {
  return (
    <div className='w-64 bg-gray-900 text-white min-h-screen p-4'>
      <h2 className='text-xl font-bold mb-6'>DealFlow360</h2>
      <div className='space-y-4'>
        <div>
          <h3 className='text-sm uppercase text-gray-400 mb-2'>Admin</h3>
          <ul className='space-y-1 text-sm'>
            <li><Link href='/admin/warehouses' className='hover:text-blue-400'>Warehouses</Link></li>
            <li><Link href='/admin/inventory' className='hover:text-blue-400'>Inventory</Link></li>
            <li><Link href='/admin/subscription-plans' className='hover:text-blue-400'>Subscription Plans</Link></li>
          </ul>
        </div>
        <div>
          <h3 className='text-sm uppercase text-gray-400 mb-2'>Operations</h3>
          <ul className='space-y-1 text-sm'>
            <li><Link href='/operations/fulfillment' className='hover:text-blue-400'>Fulfillment</Link></li>
            <li><Link href='/operations/backorders' className='hover:text-blue-400'>Backorders</Link></li>
          </ul>
        </div>
        <div>
          <h3 className='text-sm uppercase text-gray-400 mb-2'>Finance</h3>
          <ul className='space-y-1 text-sm'>
            <li><Link href='/finance/subscriptions' className='hover:text-blue-400'>Subscriptions</Link></li>
            <li><Link href='/finance/invoices' className='hover:text-blue-400'>Invoices</Link></li>
            <li><Link href='/finance/payments' className='hover:text-blue-400'>Payments</Link></li>
            <li><Link href='/finance/credit-notes' className='hover:text-blue-400'>Credit Notes</Link></li>
          </ul>
        </div>
        <div>
          <h3 className='text-sm uppercase text-gray-400 mb-2'>Management</h3>
          <ul className='space-y-1 text-sm'>
            <li><Link href='/management/deal-health' className='hover:text-blue-400'>Deal Health</Link></li>
            <li><Link href='/management/reports' className='hover:text-blue-400'>Reports</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
