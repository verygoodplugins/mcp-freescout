import { config as dotenvConfig } from 'dotenv';

export function loadEnv() {
  dotenvConfig({ quiet: true });
}
