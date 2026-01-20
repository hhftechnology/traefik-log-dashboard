import { NextRequest, NextResponse } from 'next/server';
import { getSelectedAgent, getAgentById } from '@/lib/db/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position') || '-2';
    const lines = searchParams.get('lines') || '1000';
    const tail = searchParams.get('tail') || 'false';
    const agentId = searchParams.get('agentId');

    let agent;
    if (agentId) {
      agent = getAgentById(agentId);
      if (!agent) {
        return NextResponse.json(
          { error: `Agent with ID ${agentId} not found` },
          { status: 404 }
        );
      }
    } else {
      agent = getSelectedAgent();
      if (!agent) {
        return NextResponse.json(
          { error: 'No agent selected or available. Please configure an agent.' },
          { status: 404 }
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Fetching from agent [${agent.name}]:`, `${agent.url}/api/logs/access?position=${position}&lines=${lines}&tail=${tail}`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    };

    if (agent.token) {
      headers['Authorization'] = `Bearer ${agent.token}`;
    }

    const agentUrl = `${agent.url}/api/logs/access?position=${position}&lines=${lines}&tail=${tail}`;

    const response = await fetch(agentUrl, { 
      headers,
      cache: 'no-store',
      next: { revalidate: 0 }
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Agent [${agent.name}] error:`, error);
      return NextResponse.json(
        { error: `Agent error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log agent response for debugging (using console.warn for non-critical info)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Agent [${agent.name}] returned`, data.logs?.length || 0, 'logs');
    }

    // Add agent info to response
    const responseData = {
      ...data,
      agent: {
        id: agent.id,
        name: agent.name,
      },
    };

    const res = NextResponse.json(responseData);
    res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.headers.set('Pragma', 'no-cache');
    res.headers.set('Expires', '0');
    
    return res;
  } catch (error) {
    console.error('Access logs API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch access logs', details: String(error) },
      { status: 500 }
    );
  }
}