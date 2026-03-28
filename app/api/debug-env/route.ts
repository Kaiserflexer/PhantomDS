import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  return NextResponse.json({
    hasBlobToken: Boolean(token),
    tokenPrefix: token ? token.slice(0, 14) : null,
    tokenLength: token ? token.length : 0,
    nodeEnv: process.env.NODE_ENV ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null
  });
}
