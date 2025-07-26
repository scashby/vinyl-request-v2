// src/app/api/block-sides/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Block Sides API is available',
    blockedSides: [],
    status: 'active'
  });
}