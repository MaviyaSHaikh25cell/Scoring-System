import type {
  Tournament,
  TournamentMatch,
  TournamentRound,
  TournamentWeightCategory,
} from '../constants/storage';

import type {
  PdfPageData,
  PdfTextItem,
} from '../components/PdfTextExtractor';

export type BoxerRegistryItem = {
  id: string;
  name: string;
  dateOfBirth?: string;
  weight?: string;
  club?: string;
  coach?: string;
  stance?: string;
  status?: string;
};

type ParsedBoutRow = {
  boutNumber: number;
  weight: string;
  redBoxer: string | null;
  redClub: string | null;
  blueBoxer: string | null;
  blueClub: string | null;
  category: string;
};

type SourceReference = {
  boutNumber: number;
  text: string;
};

/*
 * PDF headings such as:
 *
 * UNDER-15 BOYS
 * UNDER-13 BOYS
 * UNDER-15 GIRLS
 * UNDER-11 BOYS
 */
const CATEGORY_REGEX =
  /UNDER\s*-\s*(\d+)\s*(BOYS|GIRLS)/i;

/*
 * PDF progression references such as:
 *
 * WINNER OF BOUT NO 1
 * WINNER OF BOUT NO 14
 * WINNER BOUT NO 7
 */
const WINNER_REFERENCE_REGEX =
  /WINNER\s+(?:OF\s+)?BOUT\s+NO\.?\s*(\d+)/i;

/*
 * These are the approximate X positions in the
 * official Boxing Association of Pune PDF.
 */
const COLUMN_X = {
  bout: 74,
  weight: 117,
  redBoxer: 180,
  redClub: 350,
  blueBoxer: 460,
  blueClub: 615,
};

const Y_TOLERANCE = 5;

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, '')
    .trim();
}

function normalizeName(value: string): string {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

function cleanWeight(value: string): string {
  return normalizeText(value)
    .replace(/\s*KG\s*$/i, '')
    .trim();
}

function isWinnerReference(value: string): boolean {
  return WINNER_REFERENCE_REGEX.test(
    normalizeText(value),
  );
}

function isByeMarker(value: string): boolean {
  return /^(?:BYE|W\/?O|WALKOVER|WALK\s+OVER)$/i.test(
    normalizeText(value),
  );
}

function getWinnerReference(
  value: string,
): SourceReference | null {
  const match = normalizeText(value).match(
    WINNER_REFERENCE_REGEX,
  );

  if (!match) {
    return null;
  }

  return {
    boutNumber: Number(match[1]),
    text: normalizeText(value),
  };
}

function isCategoryHeading(
  value: string,
): boolean {
  return CATEGORY_REGEX.test(
    normalizeText(value),
  );
}

function getCategoryHeading(
  value: string,
): string | null {
  const match = normalizeText(value).match(
    CATEGORY_REGEX,
  );

  if (!match) {
    return null;
  }

  const age = match[1];
  const gender = match[2].toUpperCase();

  return `UNDER-${age} ${gender}`;
}

function isWeightRange(
  value: string,
): boolean {
  return /^\d+\s*-\s*\d+$/.test(
    normalizeText(value),
  );
}

function isBoutNumber(
  value: string,
): boolean {
  return /^\d+$/.test(
    normalizeText(value),
  );
}

function getX(item: PdfTextItem): number {
  return typeof item.x === 'number'
    ? item.x
    : 0;
}

function getY(item: PdfTextItem): number {
  return typeof item.y === 'number'
    ? item.y
    : 0;
}

/*
 * PDF.js returns individual text items.
 * This groups items that belong to the same
 * visual row.
 */
function groupItemsIntoLines(
  items: PdfTextItem[],
): PdfTextItem[][] {
  const sorted = [...items].sort(
    (a, b) => {
      const yDifference =
        getY(a) - getY(b);

      if (
        Math.abs(yDifference) >
        Y_TOLERANCE
      ) {
        return yDifference;
      }

      return getX(a) - getX(b);
    },
  );

  const lines: PdfTextItem[][] = [];

  for (const item of sorted) {
    const lastLine =
      lines[lines.length - 1];

    if (!lastLine) {
      lines.push([item]);
      continue;
    }

    const averageY =
      lastLine.reduce(
        (sum, currentItem) =>
          sum + getY(currentItem),
        0,
      ) / lastLine.length;

    if (
      Math.abs(
        getY(item) - averageY,
      ) <= Y_TOLERANCE
    ) {
      lastLine.push(item);
    } else {
      lines.push([item]);
    }
  }

  for (const line of lines) {
    line.sort(
      (a, b) => getX(a) - getX(b),
    );
  }

  return lines;
}

function getColumnText(
  line: PdfTextItem[],
  minimumX: number,
  maximumX: number,
): string {
  return normalizeText(
    line
      .filter((item) => {
        const x = getX(item);

        return (
          x >= minimumX &&
          x < maximumX
        );
      })
      .map((item) => item.text)
      .join(' '),
  );
}

function getColumnTextAfter(
  line: PdfTextItem[],
  minimumX: number,
): string {
  return normalizeText(
    line
      .filter(
        (item) => getX(item) >= minimumX,
      )
      .map((item) => item.text)
      .join(' '),
  );
}

function parseBoutLine(
  line: PdfTextItem[],
  currentCategory: string,
): ParsedBoutRow | null {
  const boutItem = line.find(
    (item) => isBoutNumber(item.text),
  );

  const weightItem = line.find(
    (item) =>
      isWeightRange(item.text) &&
      getX(item) >=
        COLUMN_X.weight - 20 &&
      getX(item) <
        COLUMN_X.redBoxer - 20,
  );

  if (!boutItem || !weightItem) {
    return null;
  }

  const boutNumber = Number(
    normalizeText(boutItem.text),
  );

  if (
    !Number.isInteger(boutNumber) ||
    boutNumber <= 0
  ) {
    return null;
  }

  const weight = cleanWeight(
    weightItem.text,
  );

  const redBoxerText = getColumnText(
    line,
    COLUMN_X.redBoxer - 25,
    COLUMN_X.redClub - 20,
  );
  const redBoxer = isByeMarker(redBoxerText)
    ? ''
    : redBoxerText;

  const redClub = getColumnText(
    line,
    COLUMN_X.redClub - 20,
    COLUMN_X.blueBoxer - 20,
  );

  const blueBoxerText = getColumnText(
    line,
    COLUMN_X.blueBoxer - 20,
    COLUMN_X.blueClub - 20,
  );
  const blueBoxer = isByeMarker(blueBoxerText)
    ? ''
    : blueBoxerText;

  const blueClub = getColumnTextAfter(
    line,
    COLUMN_X.blueClub - 20,
  );

  return {
    boutNumber,
    weight,
    redBoxer: redBoxer || null,
    redClub: redClub || null,
    blueBoxer: blueBoxer || null,
    blueClub: blueClub || null,
    category:
      currentCategory || 'UNKNOWN',
  };
}

function parsePage(
  page: PdfPageData,
): ParsedBoutRow[] {
  const lines =
    groupItemsIntoLines(page.items);

  let currentCategory = 'UNKNOWN';

  const rows: ParsedBoutRow[] = [];

  for (const line of lines) {
    const lineText = normalizeText(
      line
        .map((item) => item.text)
        .join(' '),
    );

    if (isCategoryHeading(lineText)) {
      currentCategory =
        getCategoryHeading(lineText) ||
        currentCategory;

      continue;
    }

    const row = parseBoutLine(
      line,
      currentCategory,
    );

    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

function uniqueStrings(
  values: Array<
    string | null | undefined
  >,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized =
      normalizeName(value);

    if (
      !normalized ||
      normalized === 'WINNER' ||
      normalized.startsWith(
        'WINNER OF BOUT',
      ) ||
      isWinnerReference(normalized)
    ) {
      continue;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function findRegistryBoxer(
  name: string,
  registry: BoxerRegistryItem[],
): BoxerRegistryItem | null {
  const normalized =
    normalizeName(name);

  return (
    registry.find(
      (boxer) =>
        normalizeName(boxer.name) ===
        normalized,
    ) || null
  );
}

/*
 * Determine tournament round from the
 * dependency structure.
 *
 * No dependency:
 *   PRELIMINARY
 *
 * One/two previous bouts:
 *   progression round
 *
 * Two previous bouts where those previous
 * bouts are already progression bouts:
 *   FINAL / SEMI etc.
 */
function getRoundFromDependencies(
  match: TournamentMatch,
  byId: Map<string, TournamentMatch>,
): TournamentRound {
  const previousMatches =
    match.previousMatchIds
      .map((id) => byId.get(id))
      .filter(
        (
          item,
        ): item is TournamentMatch =>
          Boolean(item),
      );

  if (previousMatches.length === 0) {
    return 'PRELIMINARY';
  }

  if (previousMatches.length === 1) {
    return 'SEMI_FINAL';
  }

  const previousHasDependencies =
    previousMatches.some(
      (previous) =>
        previous.previousMatchIds.length >
        0,
    );

  if (previousHasDependencies) {
    return 'FINAL';
  }

  return 'SEMI_FINAL';
}

function getStatus(
  redSourceMatchId: string | null,
  blueSourceMatchId: string | null,
  redBoxer: string | null,
  blueBoxer: string | null,
): 'LOCKED' | 'UPCOMING' {
  const hasMissingSource =
    (redSourceMatchId !== null &&
      redBoxer === null) ||
    (blueSourceMatchId !== null &&
      blueBoxer === null);

  if (hasMissingSource) {
    return 'LOCKED';
  }

  if (redBoxer && blueBoxer) {
    return 'UPCOMING';
  }

  return 'LOCKED';
}

function createMatchId(
  tournamentId: string,
  boutNumber: number,
): string {
  return `${tournamentId}-BOUT-${String(
    boutNumber,
  ).padStart(3, '0')}`;
}

function getSourceMatchId(
  reference: SourceReference | null,
  tournamentId: string,
): string | null {
  if (!reference) {
    return null;
  }

  return createMatchId(
    tournamentId,
    reference.boutNumber,
  );
}

function parseSource(
  boxer: string | null,
): SourceReference | null {
  if (!boxer) {
    return null;
  }

  return getWinnerReference(boxer);
}

function buildMatches(
  rows: ParsedBoutRow[],
  tournamentId: string,
): TournamentMatch[] {
  const sortedRows = [...rows].sort(
    (a, b) =>
      a.boutNumber -
      b.boutNumber,
  );

  const matches: TournamentMatch[] =
    [];

  for (const row of sortedRows) {
    const matchId = createMatchId(
      tournamentId,
      row.boutNumber,
    );

    const redSource = parseSource(
      row.redBoxer,
    );

    const blueSource = parseSource(
      row.blueBoxer,
    );

    const redIsSource =
      redSource !== null;

    const blueIsSource =
      blueSource !== null;

    const redBoxer = redIsSource
      ? null
      : row.redBoxer;

    const blueBoxer = blueIsSource
      ? null
      : row.blueBoxer;

    const previousMatchIds = [
      redSource?.boutNumber,
      blueSource?.boutNumber,
    ]
      .filter(
        (
          value,
        ): value is number =>
          typeof value ===
          'number',
      )
      .map((boutNumber) =>
        createMatchId(
          tournamentId,
          boutNumber,
        ),
      );

    matches.push({
      id: matchId,
      round: 'PRELIMINARY',
      matchNumber:
        row.boutNumber,
      weightCategory:
        row.weight,
      redBoxer,
      blueBoxer,
      redClub: redIsSource
        ? null
        : row.redClub,
      blueClub: blueIsSource
        ? null
        : row.blueClub,
      redSourceMatchId:
        getSourceMatchId(
          redSource,
          tournamentId,
        ),
      blueSourceMatchId:
        getSourceMatchId(
          blueSource,
          tournamentId,
        ),
      redSourceText:
        redSource?.text || null,
      blueSourceText:
        blueSource?.text || null,
      winner:
        Boolean(redBoxer) !== Boolean(blueBoxer) &&
        !(redIsSource || blueIsSource)
          ? (redBoxer || blueBoxer)
          : null,
      winnerClub:
        Boolean(redBoxer) !== Boolean(blueBoxer) &&
        !(redIsSource || blueIsSource)
          ? (redBoxer ? row.redClub : row.blueClub) ?? null
          : null,
      status:
        Boolean(redBoxer) !== Boolean(blueBoxer) &&
        !(redIsSource || blueIsSource)
          ? 'COMPLETED'
          : getStatus(
              getSourceMatchId(
                redSource,
                tournamentId,
              ),
              getSourceMatchId(
                blueSource,
                tournamentId,
              ),
              redBoxer,
              blueBoxer,
            ),
      nextMatchId: null,
      previousMatchIds,
      rounds: 3,
      matchType: 'Tournament',
      scoringMatchId: null,
    });
  }

  const byId = new Map<
    string,
    TournamentMatch
  >();

  for (const match of matches) {
    byId.set(match.id, match);
  }

  for (const match of matches) {
    match.round =
      getRoundFromDependencies(
        match,
        byId,
      );
  }

  return matches;
}

function connectNextMatches(
  matches: TournamentMatch[],
): TournamentMatch[] {
  const byId = new Map<
    string,
    TournamentMatch
  >();

  for (const match of matches) {
    byId.set(match.id, match);
  }

  for (const match of matches) {
    const sources = [
      match.redSourceMatchId,
      match.blueSourceMatchId,
    ];

    for (const sourceId of sources) {
      if (!sourceId) {
        continue;
      }

      const sourceMatch =
        byId.get(sourceId);

      if (!sourceMatch) {
        continue;
      }

      sourceMatch.nextMatchId =
        match.id;
    }
  }

  return matches;
}

/**
 * Resolve first-round walkovers discovered during PDF import. A bout
 * with exactly one named boxer and no source bout feeding the empty
 * corner is a bye. Its winner is advanced through the bracket; if that
 * creates another single-boxer bout with no expected opponent, that
 * bout is also recorded as a walkover. This runs before the tournament
 * is saved, so no scoring match is required for a bye.
 */
function assignRoundsFromProgression(
  matches: TournamentMatch[],
): TournamentMatch[] {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const depths = new Map<string, number>();
  let maxDepth = 0;

  for (const match of matches) {
    let current = match;
    let depth = 0;
    const visited = new Set<string>([match.id]);

    while (current.nextMatchId) {
      const nextId = current.nextMatchId;
      if (visited.has(nextId)) break;
      const next = byId.get(nextId);
      if (!next) break;
      visited.add(nextId);
      depth += 1;
      current = next;
    }

    depths.set(match.id, depth);
    maxDepth = Math.max(maxDepth, depth);
  }

  for (const match of matches) {
    const depth = depths.get(match.id) ?? 0;
    if (depth === 0) {
      match.round = 'FINAL';
    } else if (depth === 1) {
      match.round = 'SEMI_FINAL';
    } else if (maxDepth >= 3 && depth === 2) {
      match.round = 'QUARTER_FINAL';
    } else if (maxDepth >= 3 && depth === 3) {
      match.round = 'ROUND_OF_16';
    } else if (maxDepth >= 4 && depth >= 4) {
      match.round = 'PRELIMINARY';
    } else {
      // Smaller brackets skip quarter-finals/round-of-16 stages.
      match.round = 'PRELIMINARY';
    }
  }

  return matches;
}

function propagateImportedWalkovers(
  matches: TournamentMatch[],
): TournamentMatch[] {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const maxPasses = Math.max(matches.length, 1);

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const source of matches) {
      if (
        source.status !== 'COMPLETED' ||
        !source.winner ||
        !source.nextMatchId
      ) {
        continue;
      }

      const next = byId.get(source.nextMatchId);
      if (!next || next.status === 'LIVE') continue;

      const feedsRed = next.redSourceMatchId === source.id;
      const feedsBlue = next.blueSourceMatchId === source.id;
      if (!feedsRed && !feedsBlue) continue;

      // Do not change a completed bout unless it is already a generated
      // walkover from this same chain.
      if (
        next.status === 'COMPLETED' &&
        next.winner !== source.winner &&
        next.redSourceText !== 'BYE / WALKOVER' &&
        next.blueSourceText !== 'BYE / WALKOVER'
      ) {
        continue;
      }

      const target: 'red' | 'blue' = feedsRed ? 'red' : 'blue';
      const other: 'red' | 'blue' = target === 'red' ? 'blue' : 'red';
      const otherName = other === 'red' ? next.redBoxer : next.blueBoxer;
      const duplicateSource = feedsRed && feedsBlue;
      const duplicateName = Boolean(otherName) &&
        otherName!.trim().toLocaleLowerCase() ===
          source.winner.trim().toLocaleLowerCase();

      if (target === 'red') {
        next.redBoxer = source.winner;
        next.redClub = source.winnerClub;
        next.redSourceText = `Winner of Bout ${source.matchNumber}`;
      } else {
        next.blueBoxer = source.winner;
        next.blueClub = source.winnerClub;
        next.blueSourceText = `Winner of Bout ${source.matchNumber}`;
      }

      if (duplicateSource && otherName && !duplicateName) {
        // Preserve a distinct boxer already assigned to the opposite
        // corner; only remove the contradictory feeder reference.
        if (other === 'red') next.redSourceMatchId = null;
        else next.blueSourceMatchId = null;
        next.status = next.redBoxer && next.blueBoxer
          ? 'UPCOMING'
          : 'LOCKED';
        changed = true;
        continue;
      }

      if (duplicateSource || duplicateName) {
        if (other === 'red') {
          next.redBoxer = null;
          next.redClub = null;
          next.redSourceMatchId = null;
          next.redSourceText = 'BYE / WALKOVER';
        } else {
          next.blueBoxer = null;
          next.blueClub = null;
          next.blueSourceMatchId = null;
          next.blueSourceText = 'BYE / WALKOVER';
        }
        next.winner = source.winner;
        next.winnerClub = source.winnerClub;
        next.status = 'COMPLETED';
        changed = true;
        continue;
      }

      const hasRed = Boolean(next.redBoxer);
      const hasBlue = Boolean(next.blueBoxer);
      if (hasRed && hasBlue) {
        if (next.status !== 'COMPLETED') next.status = 'UPCOMING';
        changed = true;
        continue;
      }

      if (hasRed !== hasBlue) {
        const emptyCorner: 'red' | 'blue' = hasRed ? 'blue' : 'red';
        const emptySourceId = emptyCorner === 'red'
          ? next.redSourceMatchId
          : next.blueSourceMatchId;
        if (!emptySourceId) {
          const advancingName = hasRed ? next.redBoxer : next.blueBoxer;
          const advancingClub = hasRed ? next.redClub : next.blueClub;
          if (emptyCorner === 'red') next.redSourceText = 'BYE / WALKOVER';
          else next.blueSourceText = 'BYE / WALKOVER';
          next.winner = advancingName;
          next.winnerClub = advancingClub;
          next.status = 'COMPLETED';
          changed = true;
        } else if (next.status !== 'COMPLETED') {
          next.status = 'LOCKED';
        }
      }
    }

    if (!changed) break;
  }

  return matches;
}

function createWeightCategories(
  matches: TournamentMatch[],
): TournamentWeightCategory[] {
  const categoryMap =
    new Map<
      string,
      TournamentWeightCategory
    >();

  for (const match of matches) {
    const name =
      match.weightCategory ||
      'UNKNOWN';

    let category =
      categoryMap.get(name);

    if (!category) {
      category = {
        id: `WEIGHT-${name
          .replace(
            /[^A-Z0-9]+/gi,
            '-',
          )
          .replace(
            /^-|-$/g,
            '',
          )
          .toUpperCase()}`,
        name,
        boxerIds: [],
        matches: [],
      };

      categoryMap.set(
        name,
        category,
      );
    }

    category.matches.push(match);
  }

  return Array.from(
    categoryMap.values(),
  );
}

function collectBoxerNames(
  rows: ParsedBoutRow[],
): string[] {
  return uniqueStrings([
    ...rows.flatMap((row) => [
      row.redBoxer,
      row.blueBoxer,
    ]),
  ]);
}

function getBoxerIds(
  boxerNames: string[],
  registry: BoxerRegistryItem[],
): string[] {
  const ids: string[] = [];

  for (const name of boxerNames) {
    const boxer =
      findRegistryBoxer(
        name,
        registry,
      );

    if (
      boxer &&
      !ids.includes(boxer.id)
    ) {
      ids.push(boxer.id);
    }
  }

  return ids;
}

function inferTournamentDate(
  pages: PdfPageData[],
): string {
  const allText = pages
    .flatMap((page) =>
      page.items.map((item) =>
        normalizeText(item.text),
      ),
    )
    .join(' ');

  const dateMatch =
    allText.match(
      /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/,
    );

  if (dateMatch) {
    const day =
      dateMatch[1].padStart(2, '0');

    const month =
      dateMatch[2].padStart(2, '0');

    const year = dateMatch[3];

    return `${year}-${month}-${day}`;
  }

  return new Date()
    .toISOString()
    .slice(0, 10);
}

function inferOrganization(
  pages: PdfPageData[],
): string {
  const allText = pages
    .flatMap((page) =>
      page.items.map((item) =>
        normalizeText(item.text),
      ),
    )
    .join(' ');

  if (
    /BOXING ASSOCIATION OF PUNE/i.test(
      allText,
    )
  ) {
    return 'BOXING ASSOCIATION OF PUNE';
  }

  return 'BOXING TOURNAMENT';
}

function inferRounds(): number {
  return 3;
}

function deduplicateRows(
  rows: ParsedBoutRow[],
): ParsedBoutRow[] {
  const map =
    new Map<
      number,
      ParsedBoutRow
    >();

  for (const row of rows) {
    if (
      !map.has(row.boutNumber)
    ) {
      map.set(
        row.boutNumber,
        row,
      );
    }
  }

  return Array.from(
    map.values(),
  ).sort(
    (a, b) =>
      a.boutNumber -
      b.boutNumber,
  );
}

/**
 * Converts the text/coordinate data
 * extracted by PdfTextExtractor into
 * the tournament data model.
 *
 * PDF reading itself is NOT performed here.
 */
export function parseExtractedTournamentPdf(
  pages: PdfPageData[],
  tournamentName: string,
  pdfFileName: string,
  boxerRegistry: BoxerRegistryItem[],
): Tournament {
  if (
    !Array.isArray(pages) ||
    pages.length === 0
  ) {
    throw new Error(
      'No PDF pages were extracted.',
    );
  }

  const parsedRows =
    pages.flatMap((page) =>
      parsePage(page),
    );

  const rows =
    deduplicateRows(
      parsedRows,
    );

  if (rows.length === 0) {
    throw new Error(
      'No boxing bouts could be found in this PDF.',
    );
  }

  const tournamentId =
    `TOURNAMENT-${Date.now()}`;

  const matches =
    buildMatches(
      rows,
      tournamentId,
    );

  const connectedMatches =
    assignRoundsFromProgression(
      propagateImportedWalkovers(
        connectNextMatches(matches),
      ),
    );

  const boxerNames =
    collectBoxerNames(rows);

  const boxerIds =
    getBoxerIds(
      boxerNames,
      boxerRegistry,
    );

  const rounds =
    inferRounds();

  for (const match of connectedMatches) {
    match.rounds = rounds;
  }

  const weightCategories =
    createWeightCategories(
      connectedMatches,
    );

  const tournament: Tournament = {
    id: tournamentId,
    name:
      tournamentName.trim(),
    organization:
      inferOrganization(pages),
    date:
      inferTournamentDate(pages),
    pdfFileName:
      pdfFileName || null,
    createdAt:
      new Date().toISOString(),
    status: 'UPCOMING',
    boxerCount:
      boxerNames.length,
    weightCategories:
      weightCategories.map(
        (category) => ({
          ...category,
          boxerIds,
        }),
      ),
  };

  return tournament;
}

/**
 * Legacy-compatible function name.
 *
 * Direct PDF extraction is intentionally
 * disabled. Expo Go uses PdfTextExtractor.
 */
export async function parseTournamentPdf(
  _pdfUri: string,
  _tournamentName: string,
  _pdfFileName: string,
  _boxerRegistry: BoxerRegistryItem[],
): Promise<Tournament> {
  throw new Error(
    'PDF extraction must be performed through PdfTextExtractor in Expo Go.',
  );
}

/**
 * Returns a simple import summary.
 */
export function getTournamentImportSummary(
  tournament: Tournament,
): {
  boxerCount: number;
  matchCount: number;
  categoryCount: number;
} {
  const matchCount =
    tournament.weightCategories.reduce(
      (total, category) =>
        total +
        category.matches.length,
      0,
    );

  return {
    boxerCount:
      tournament.boxerCount,
    matchCount,
    categoryCount:
      tournament.weightCategories
        .length,
  };
}