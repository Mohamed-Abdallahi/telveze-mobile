import Constants from 'expo-constants';
import { Platform } from 'react-native';

const ENV = {
  dev: {
    // For iOS simulator / web
    apiUrl: Platform.OS === 'android' 
      ? 'http://10.0.2.2:3000/api'  // Android emulator
      : 'http://localhost:3000/api',  // iOS simulator / web
  },
  prod: {
    apiUrl: 'https://api.telvese.mr/api',
  },
};

function getEnvVars(env = Constants.expoConfig?.releaseChannel) {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
}

export default getEnvVars();
