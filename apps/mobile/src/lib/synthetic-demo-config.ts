import { Platform } from 'react-native';

import { allowsSyntheticDemo } from './synthetic-demo';

export const syntheticDemoEnabled = allowsSyntheticDemo(__DEV__, Platform.OS, process.env.EXPO_PUBLIC_SYNTHETIC_DEMO);
