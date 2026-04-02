import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '../../../../../../lib/api-client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = await apiClient.post<any>(`/api/v1/uploads/${id}/approve`, body);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Unknown error' },
      { status: error.status || 500 }
    );
  }
}
