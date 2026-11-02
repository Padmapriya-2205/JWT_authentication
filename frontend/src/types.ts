export interface User {
  id: string;
  username: string;
  name: string;
  phoneNumber: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}
