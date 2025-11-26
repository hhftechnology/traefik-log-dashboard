import { NextRequest, NextResponse } from 'next/server';
import { getNotificationHistory } from '@/lib/db/database';

export const dynamic = 'force-dynamic';

/**
 * GET /api/alerts/stats - Get alert statistics
 */
export async function GET() {
  try {
    const history = getNotificationHistory(1000); // Get last 1000 notifications
    
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const total = history.length;
    const last24h = history.filter(h => new Date(h.created_at).getTime() > oneDayAgo).length;
    const success = history.filter(h => h.status === 'success').length;
    const failed = history.filter(h => h.status === 'failed').length;

    return NextResponse.json({
      total,
      last24h,
      success,
      failed,
      history: history.slice(0, 5) // Return latest 5 for preview
    });
  } catch (error) {
    console.error('Failed to fetch alert stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alert stats' },
      { status: 500 }
    );
  }
}
