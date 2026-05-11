
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/firebase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return new NextResponse('Missing filePath parameter', { status: 400 });
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
        return new NextResponse('File not found', { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const stream = file.createReadStream();

    // The 'as any' is a workaround because ReadableStream from Node.js and from web standards are slightly different.
    // Next.js handles this correctly under the hood.
    const response = new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${metadata.name?.split('/').pop()}"`,
      },
    });

    return response;

  } catch (error: any) {
    console.error('Error proxying file download:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
