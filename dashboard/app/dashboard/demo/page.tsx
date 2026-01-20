import { notFound } from 'next/navigation';
import DemoDashboardClient from './DemoDashboardClient';

export const dynamic = 'force-dynamic';

export default function DemoDashboardPage() {
  const showDemoPage =
    (process.env.NEXT_PUBLIC_SHOW_DEMO_PAGE ?? process.env.SHOW_DEMO_PAGE ?? 'true') !== 'false';

  if (!showDemoPage) {
    // Hide demo route completely when disabled
    return notFound();
  }

  return <DemoDashboardClient />;
}
