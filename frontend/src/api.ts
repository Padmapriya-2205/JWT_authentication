import type { AuthResponse, User } from './types';

const API_URL = '/api';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    if (typeof body === 'object' && body !== null && 'message' in body) {
      const errorMessage = body.message;
      if (typeof errorMessage === 'string') {
        message = errorMessage;
      } else if (Array.isArray(errorMessage) && errorMessage.every((item) => typeof item === 'string')) {
        message = errorMessage.join(' ');
      }
    }
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export async function register(input: {
  username: string;
  password: string;
  name: string;
  phoneNumber: string;
}) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return readResponse<{ message: string }>(response);
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return readResponse<AuthResponse>(response);
}

export async function refreshSession(refreshToken: string) {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return readResponse<AuthResponse>(response);
}

export async function logout(refreshToken: string) {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  return readResponse<{ message: string }>(response);
}

export async function getProfile(accessToken: string): Promise<User> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return readResponse<User>(response);
}
