import { NextRequest, NextResponse } from 'next/server';
import { apiClient } from '../../../../lib/api-client';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const data = await apiClient.post<any>('/api/v1/uploads/', formData);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Unknown error' },
      { status: error.status || 500 }
    );
  }
}

export async function GET() {
  try {
    const data = await apiClient.get<any[]>('/api/v1/uploads/');
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { detail: error.message || 'Unknown error' },
      { status: error.status || 500 }
    );
  }
}
