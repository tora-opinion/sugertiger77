interface ParsedRange {
  start: number;
  end: number;
}

const BYTE_RANGE_PATTERN = /^bytes=(\d+)-(\d+)$/;
const BYTE_RANGE_FROM_START_PATTERN = /^bytes=(\d+)-$/;
const BYTE_RANGE_SUFFIX_PATTERN = /^bytes=-(\d+)$/;

export function parseByteRangeHeader(
  rangeHeader: string,
  totalSize: number,
): ParsedRange | null {
  if (!Number.isInteger(totalSize) || totalSize <= 0) {
    return null;
  }

  const normalized = rangeHeader.trim();

  const exactRangeMatch = normalized.match(BYTE_RANGE_PATTERN);
  if (exactRangeMatch) {
    const start = Number(exactRangeMatch[1]);
    const end = Number(exactRangeMatch[2]);
    if (start > end || start >= totalSize) {
      return null;
    }
    return { start, end: Math.min(end, totalSize - 1) };
  }

  const fromStartMatch = normalized.match(BYTE_RANGE_FROM_START_PATTERN);
  if (fromStartMatch) {
    const start = Number(fromStartMatch[1]);
    if (start >= totalSize) {
      return null;
    }
    return { start, end: totalSize - 1 };
  }

  const suffixMatch = normalized.match(BYTE_RANGE_SUFFIX_PATTERN);
  if (suffixMatch) {
    const suffixLength = Number(suffixMatch[1]);
    if (suffixLength <= 0) {
      return null;
    }
    if (suffixLength >= totalSize) {
      return { start: 0, end: totalSize - 1 };
    }
    return {
      start: totalSize - suffixLength,
      end: totalSize - 1,
    };
  }

  return null;
}
