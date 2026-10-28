import '@aws-amplify/react-native';
import 'react-native-get-random-values';

import { Amplify, type ResourcesConfig } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import type { KeyValueStorageInterface } from 'aws-amplify/utils';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const registryKey = 'myeczema.amplify.secure-keys';

class SecureTokenStorage implements KeyValueStorageInterface {
  private registryMutation: Promise<void> = Promise.resolve();

  private storageKey(key: string) {
    const encoded = Array.from(key)
      .map((character) => character.codePointAt(0)!.toString(16).padStart(6, '0'))
      .join('');
    return `myeczema.amplify.${encoded}`;
  }

  private async readRegistry() {
    const stored = await SecureStore.getItemAsync(registryKey);
    if (!stored) return [] as string[];

    try {
      return JSON.parse(stored) as string[];
    } catch {
      return [] as string[];
    }
  }

  private async writeRegistry(keys: string[]) {
    await SecureStore.setItemAsync(registryKey, JSON.stringify([...new Set(keys)]));
  }

  private updateRegistry(update: (keys: string[]) => string[]) {
    this.registryMutation = this.registryMutation.catch(() => undefined).then(async () => {
      const keys = await this.readRegistry();
      await this.writeRegistry(update(keys));
    });
    return this.registryMutation;
  }

  async setItem(key: string, value: string) {
    const secureKey = this.storageKey(key);
    await SecureStore.setItemAsync(secureKey, value);
    await this.updateRegistry((keys) => keys.includes(secureKey) ? keys : [...keys, secureKey]);
  }

  async getItem(key: string) {
    return SecureStore.getItemAsync(this.storageKey(key));
  }

  async removeItem(key: string) {
    const secureKey = this.storageKey(key);
    await SecureStore.deleteItemAsync(secureKey);
    await this.updateRegistry((keys) => keys.filter((storedKey) => storedKey !== secureKey));
  }

  async clear() {
    await this.registryMutation;
    const keys = await this.readRegistry();
    await Promise.all(keys.map((key) => SecureStore.deleteItemAsync(key)));
    await SecureStore.deleteItemAsync(registryKey);
  }
}

const userPoolId = process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID;
const iosClientId = process.env.EXPO_PUBLIC_COGNITO_IOS_CLIENT_ID;
const androidClientId = process.env.EXPO_PUBLIC_COGNITO_ANDROID_CLIENT_ID;
const userPoolClientId = Platform.OS === 'android' ? androidClientId : iosClientId;

export const authConfigured = Boolean(userPoolId && userPoolClientId);

if (authConfigured) {
  const authConfig: ResourcesConfig['Auth'] = {
    Cognito: {
      userPoolId: userPoolId!,
      userPoolClientId: userPoolClientId!,
      loginWith: { email: true },
      signUpVerificationMethod: 'code',
      userAttributes: { email: { required: true } },
      passwordFormat: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireNumbers: false,
        requireSpecialCharacters: false,
      },
    },
  };

  Amplify.configure({ Auth: authConfig });
  cognitoUserPoolsTokenProvider.setKeyValueStorage(new SecureTokenStorage());
}
