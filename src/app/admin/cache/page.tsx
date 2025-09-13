import { Metadata } from 'next';
import CacheManagementDashboard from '@/components/CacheManagementDashboard';

export const metadata: Metadata = {
  title: 'Cache Management - Admin',
  description: 'Cache management and monitoring dashboard',
};

export default function CachePage() {
  return (
    <div className="container mx-auto py-6">
      <CacheManagementDashboard />
    </div>
  );
}