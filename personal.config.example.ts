import type { AppConfig } from './src/config';

const config: Partial<AppConfig> = {
  eveningLightThreshold: 19,
  showBaseballTechnically: true,
  useRealLogos: false,
  personalDates: [
    { label: 'Birthday', month: 8, day: 25, category: 'personal', icon: 'spark' },
    { label: 'Anniversary', month: 6, day: 8, category: 'personal', icon: 'heart' },
  ],
  // Optional: { nfl: { primary: '#...', secondary: '#...' }, ... }
  teamAccents: {},
};

export default config;