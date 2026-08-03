import { describe, expect, it } from 'vitest';
import { clipToCalendarYear, heuristicSportsYear } from './sports';
import { eventMarkers, golfMarkers } from './events';

describe('cross-year sports data', () => {
  it('stores adjacent seasons unclipped and clips only for the flat view', () => {
    const sports = heuristicSportsYear(2026);
    const nbaStored = sports.leagues.filter(({ league }) => league === 'nba');
    expect(nbaStored).toHaveLength(2);
    expect(nbaStored[0]!.segments[0]!.start.startsWith('2025-')).toBe(true);
    expect(nbaStored[1]!.segments[1]!.end.startsWith('2027-')).toBe(true);

    const clipped = clipToCalendarYear(sports).filter(({ league }) => league === 'nba');
    expect(clipped.map(({ seasonLabel }) => seasonLabel)).toEqual(['2025–26', '2026–27']);
    expect(clipped.flatMap(({ segments }) => segments).every(({ start, end }) =>
      start.startsWith('2026-') && end.startsWith('2026-'),
    )).toBe(true);
  });

  it('cross-registers Super Bowl Sunday as a holiday', () => {
    const sports = heuristicSportsYear(2026);
    expect(eventMarkers(2026, sports).find(({ id }) => id.endsWith('super-bowl'))).toMatchObject({
      category: 'holiday',
      approximate: true,
    });
  });

  it('only emits the Ryder Cup in odd years', () => {
    expect(golfMarkers(2026).some(({ id }) => id.endsWith('ryder-cup'))).toBe(false);
    expect(golfMarkers(2027).some(({ id }) => id.endsWith('ryder-cup'))).toBe(true);
  });
});