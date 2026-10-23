/**
 * Single source of truth for the backend API address.
 *
 * Set EXPO_PUBLIC_API_URL in the frontend .env file to the
 * computer's current LAN IPv4 address, e.g. http://192.168.1.105:5000.
 * A phone running Expo Go must be on the same network as the backend PC.
 */
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = (
  configuredApiUrl || 'http://192.168.1.105:5000'
).replace(/\/+$/, '');
