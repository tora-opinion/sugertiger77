import type { Env } from '../../src/types';
import { getFileMetadata } from '../../src/storage/r2';
import { parseByteRangeHeader } from '../../src/http/range';
import { errorResponse } from '../../src/utils/response';

interface Context {
  request: Request;
  env: Env;
  params: Record<string, string>;
  next: () => Promise<Response>;
}

const FILE_ID_PATTERN = /^[0-9a-f]{16}$/;

export const onRequestGet = async (context: Context): Promise<Response> => {
  const origin = context.request.headers.get('origin');
  try {
    const id = context.params.id;
    if (!id || !FILE_ID_PATTERN.test(id)) {
      return errorResponse('Invalid file ID', 400, origin, context.env);
    }

    const metadata = await getFileMetadata(context.env.FILE_BUCKET, id);
    if (!metadata) {
      return errorResponse('File not found', 404, origin, context.env);
    }

    let contentType = metadata.contentType;
    if (contentType.startsWith('text/') && !contentType.includes('charset')) {
      contentType += '; charset=utf-8';
    }

    const filename = metadata.filename;
    const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_');
    const encodedFilename = encodeURIComponent(filename);
    const contentDisposition =
      `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;

    const totalSize = metadata.size;
    const baseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    };

    const rangeHeader = context.request.headers.get('Range');
    if (rangeHeader) {
      const parsedRange = parseByteRangeHeader(rangeHeader, totalSize);
      if (!parsedRange) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${totalSize}` },
        });
      }

      const length = parsedRange.end - parsedRange.start + 1;
      const obj = await context.env.FILE_BUCKET.get(id, {
        range: { offset: parsedRange.start, length },
      });
      if (!obj) return errorResponse('File not found', 404, origin, context.env);

      return new Response(obj.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${parsedRange.start}-${parsedRange.end}/${totalSize}`,
          'Content-Length': String(length),
        },
      });
    }

    const obj = await context.env.FILE_BUCKET.get(id);
    if (!obj) return errorResponse('File not found', 404, origin, context.env);

    return new Response(obj.body, {
      status: 200,
      headers: {
        ...baseHeaders,
        'Content-Length': String(totalSize),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to serve file';
    console.error('CDN raw error:', err);
    return errorResponse(message, 500, origin, context.env);
  }
};
