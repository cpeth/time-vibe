import type { PersonalDate } from './data/schemas';

export interface TeamColors {
  primary: string;
  secondary: string;
}

export interface AppConfig {
  eveningLightThreshold: number;
  showBaseballTechnically: boolean;
  useRealLogos: boolean;
  personalDates: PersonalDate[];
  teamAccents: {
    nfl?: TeamColors;
    nba?: TeamColors;
    nhl?: TeamColors;
  };
}

const defaults: AppConfig = {
  eveningLightThreshold: 19,
  showBaseballTechnically: true,
  useRealLogos: false,
  personalDates: [
    { label: 'Birthday', month: 8, day: 25, category: 'personal', icon: 'spark' },
  ],
  teamAccents: {},
};

const personalModules = import.meta.glob<{ default: Partial<AppConfig> }>('../personal.config.ts', {
  eager: true,
});
const personal = Object.values(personalModules)[0]?.default;

export const appConfig: AppConfig = {
  ...defaults,
  ...personal,
  teamAccents: { ...defaults.teamAccents, ...personal?.teamAccents },
  personalDates: personal?.personalDates ?? defaults.personalDates,
};