// dashboard/app/api/services/status/route.ts
import { NextResponse } from 'next/server';
import { serviceManager } from '@/lib/services/service-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services/status - Get status of all services including background scheduler
 * FIX: Added scheduler status for Issue #122
 */
export async function GET() {
  try {
    const { backgroundScheduler } = await import('@/lib/services/background-scheduler');
    
    // Get status from both scheduler and service manager
    const schedulerStatus = backgroundScheduler.getStatus();
    const serviceStatus = serviceManager.getStatus();

    return NextResponse.json({
      scheduler: schedulerStatus,
      services: serviceStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get service status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to retrieve service status',
        scheduler: { isRunning: false, error: 'Unable to get status' },
        services: { initialized: false },
      },
      { status: 500 }
    );
  }
}
