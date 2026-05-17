export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName?: string | null;
}

