import { z } from 'zod';

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const SegmentKindSchema = z.enum([
  'regular',
  'wildcard',
  'divisional',
  'conference',
  'superbowl',
  'postseason',
]);

export const SegmentSchema = z
  .object({
    kind: SegmentKindSchema,
    start: IsoDateSchema,
    end: IsoDateSchema,
  })
  .refine(({ start, end }) => start <= end, 'Segment start must precede its end');

export const LeagueSeasonSchema = z.object({
  league: z.enum(['nfl', 'nba', 'nhl']),
  seasonLabel: z.string().min(1),
  segments: z.array(SegmentSchema),
  championship: z
    .object({
      date: IsoDateSchema,
      name: z.string().min(1),
    })
    .optional(),
});

export const SportsYearSchema = z.object({
  year: z.number().int(),
  leagues: z.array(LeagueSeasonSchema),
  source: z.enum(['live', 'baked', 'heuristic']),
});

export const EventMarkerSchema = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  label: z.string().min(1),
  category: z.enum(['holiday', 'golf', 'personal', 'astro']),
  icon: z.string().optional(),
  approximate: z.boolean().optional(),
});

export const ClimateSeriesSchema = z.object({
  location: z.object({
    lat: z.number(),
    lon: z.number(),
    name: z.string(),
  }),
  daily: z.array(
    z.object({
      doy: z.number().int().min(1).max(366),
      hiF: z.number(),
      loF: z.number(),
      precipIn: z.number().nonnegative(),
    }),
  ),
});

export const ClimateActualsSchema = z.object({
  year: z.number().int(),
  location: ClimateSeriesSchema.shape.location,
  daily: z.array(
    z.object({
      date: IsoDateSchema,
      hiF: z.number(),
      loF: z.number(),
      precipIn: z.number().nonnegative(),
    }),
  ),
  source: z.enum(['live', 'baked']).default('live'),
});

export type SegmentKind = z.infer<typeof SegmentKindSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type LeagueSeason = z.infer<typeof LeagueSeasonSchema>;
export type SportsYear = z.infer<typeof SportsYearSchema>;
export type EventMarker = z.infer<typeof EventMarkerSchema>;
export type ClimateSeries = z.infer<typeof ClimateSeriesSchema>;
export type ClimateActuals = z.infer<typeof ClimateActualsSchema>;

export interface PersonalDate {
  label: string;
  month: number;
  day: number;
  category: 'personal';
  icon?: string;
}