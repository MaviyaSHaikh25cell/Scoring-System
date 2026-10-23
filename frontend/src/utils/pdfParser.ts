import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

export type ParsedPdfBout = {
  boutNumber: number;
  weightCategory: string;
  redBoxer: string | null;
  redClub: string | null;
  blueBoxer: string | null;
  blueClub: string | null;
  winner: string | null;
  result: string | null;
};

export type ParsedTournamentPdf = {
  organization: string | null;
  date: string | null;
  bouts: ParsedPdfBout[];
  rawText: string;
};

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
}

function extractDate(text: string): string | null {
  const datePatterns = [
    /\b\d{2}\/\d{2}\/\d{4}\b/,
    /\b\d{2}-\d{2}-\d{4}\b/,
    /\b\d{2}\.\d{2}\.\d{4}\b/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);

    if (match) {
      return match[0];
    }
  }

  return null;
}

function extractOrganization(lines: string[]): string | null {
  for (const line of lines) {
    const upper = line.toUpperCase();

    if (
      upper.includes('BOXING ASSOCIATION') ||
      upper.includes('BOXING FEDERATION') ||
      upper.includes('BOXING CLUB') ||
      upper.includes('BOXING ASSOCIATION OF')
    ) {
      return line;
    }
  }

  return null;
}

function extractBoutNumber(line: string): number | null {
  const match = line.match(
    /(?:BOUT\s*(?:NO\.?|NUMBER)?\s*)?(\d{1,3})\b/i,
  );

  if (!match) {
    return null;
  }

  const number = Number(match[1]);

  if (!Number.isInteger(number) || number <= 0) {
    return null;
  }

  return number;
}

function isWeightCategory(line: string): boolean {
  const upper = line.toUpperCase();

  const keywords = [
    'FLYWEIGHT',
    'BANTAMWEIGHT',
    'FEATHERWEIGHT',
    'LIGHTWEIGHT',
    'WELTERWEIGHT',
    'MIDDLEWEIGHT',
    'LIGHT HEAVYWEIGHT',
    'HEAVYWEIGHT',
    'SUPER HEAVYWEIGHT',
  ];

  return keywords.some((keyword) => upper.includes(keyword));
}

function parseWeightCategory(line: string): string | null {
  if (!isWeightCategory(line)) {
    return null;
  }

  return cleanText(line);
}

function isWinnerReference(value: string): boolean {
  return /WINNER\s+(?:OF\s+)?BOUT/i.test(value);
}

function cleanBoxerName(value: string): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  if (
    /^WINNER\b/i.test(cleaned) ||
    /^BYE$/i.test(cleaned) ||
    /^TBD$/i.test(cleaned) ||
    /^N\/A$/i.test(cleaned)
  ) {
    return cleaned;
  }

  return cleaned;
}

function parseBoutLine(
  line: string,
  currentWeightCategory: string,
): ParsedPdfBout | null {
  const boutNumber = extractBoutNumber(line);

  if (boutNumber === null) {
    return null;
  }

  const upper = line.toUpperCase();

  if (
    upper.includes('BOUT NO') &&
    !upper.includes('WINNER') &&
    !/\d+\s+[A-Z]/i.test(line)
  ) {
    return null;
  }

  let remaining = line
    .replace(
      /^(?:BOUT\s*(?:NO\.?|NUMBER)?\s*)?\d{1,3}[\s:.)-]*/i,
      '',
    )
    .trim();

  if (!remaining) {
    return {
      boutNumber,
      weightCategory: currentWeightCategory,
      redBoxer: null,
      redClub: null,
      blueBoxer: null,
      blueClub: null,
      winner: null,
      result: null,
    };
  }

  let winner: string | null = null;
  let result: string | null = null;

  const resultMatch = remaining.match(
    /\b(WIN|RED|BLUE|DRAW|RSC|KO|TKO|DQ|WO|W\.?O\.?)\b$/i,
  );

  if (resultMatch) {
    result = resultMatch[1];
    remaining = remaining
      .slice(0, resultMatch.index)
      .trim()
      .replace(/[|,;]+$/, '')
      .trim();
  }

  const winnerMatch = remaining.match(
    /(?:WINNER\s*[:\-]\s*)(.+)$/i,
  );

  if (winnerMatch) {
    winner = cleanBoxerName(winnerMatch[1]);
    remaining = remaining
      .slice(0, winnerMatch.index)
      .trim()
      .replace(/[|,;]+$/, '')
      .trim();
  }

  const separatorParts = remaining
    .split(/\s+(?:VS|V\/S|VERSUS)\s+/i)
    .map((part) => cleanText(part))
    .filter(Boolean);

  let redBoxer: string | null = null;
  let blueBoxer: string | null = null;

  if (separatorParts.length >= 2) {
    redBoxer = cleanBoxerName(separatorParts[0]);
    blueBoxer = cleanBoxerName(separatorParts[1]);
  } else {
    const pipeParts = remaining
      .split(/\s*\|\s*/)
      .map((part) => cleanText(part))
      .filter(Boolean);

    if (pipeParts.length >= 2) {
      redBoxer = cleanBoxerName(pipeParts[0]);
      blueBoxer = cleanBoxerName(pipeParts[1]);
    } else if (isWinnerReference(remaining)) {
      redBoxer = cleanBoxerName(remaining);
    } else {
      redBoxer = cleanBoxerName(remaining);
    }
  }

  return {
    boutNumber,
    weightCategory: currentWeightCategory,
    redBoxer,
    redClub: null,
    blueBoxer,
    blueClub: null,
    winner,
    result,
  };
}

export async function parseTournamentPdf(
  fileUri: string,
): Promise<ParsedTournamentPdf> {
  if (!fileUri) {
    throw new Error('PDF file URI is missing.');
  }

  const response = await fetch(fileUri);

  if (!response.ok) {
    throw new Error('Unable to open the selected PDF.');
  }

  const arrayBuffer = await response.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await loadingTask.promise;

  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item: any) => {
        if (typeof item?.str === 'string') {
          return item.str;
        }

        return '';
      })
      .join(' ');

    pageTexts.push(pageText);
  }

  const rawText = pageTexts.join('\n');
  const lines = normalizeLines(rawText);

  const organization = extractOrganization(lines);
  const date = extractDate(rawText);

  const bouts: ParsedPdfBout[] = [];

  let currentWeightCategory = 'UNKNOWN';

  for (const line of lines) {
    const category = parseWeightCategory(line);

    if (category) {
      currentWeightCategory = category;
      continue;
    }

    const bout = parseBoutLine(line, currentWeightCategory);

    if (!bout) {
      continue;
    }

    if (
      bouts.some(
        (existingBout) => existingBout.boutNumber === bout.boutNumber,
      )
    ) {
      continue;
    }

    bouts.push(bout);
  }

  bouts.sort((a, b) => a.boutNumber - b.boutNumber);

  if (bouts.length === 0) {
    throw new Error(
      'No boxing bouts could be found in this PDF. Please check that the PDF contains selectable text.',
    );
  }

  return {
    organization,
    date,
    bouts,
    rawText,
  };
}