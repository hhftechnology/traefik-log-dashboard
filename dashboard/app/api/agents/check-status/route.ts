// dashboard/app/api/agents/check-status/route.ts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface CheckStatusRequest {
  agentUrl: string;
  agentToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckStatusRequest = await request.json();
    const { agentUrl, agentToken } = body;

    if (!agentUrl || !agentToken) {
      return NextResponse.json(
        { error: 'Missing agentUrl or agentToken' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(agentUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid agent URL format' },
        { status: 400 }
      );
    }

    // Check agent status endpoint with authentication
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Authorization': `Bearer ${agentToken}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(`${agentUrl}/api/logs/status`, {
        headers,
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          {
            online: false,
            error: `Agent returned ${response.status}: ${response.statusText}`,
          },
          { status: 200 } // Return 200 so the frontend can handle the offline status
        );
      }

      const data = await response.json();

      return NextResponse.json({
        online: true,
        version: data.version || 'unknown',
        uptime: data.uptime || 0,
        agentInfo: data,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          return NextResponse.json(
            { online: false, error: 'Connection timeout' },
            { status: 200 }
          );
        }

        return NextResponse.json(
          { online: false, error: `Connection failed: ${fetchError.message}` },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { online: false, error: 'Unknown connection error' },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Agent status check error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check agent status',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}