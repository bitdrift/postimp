export interface PendingRegistration {
  id: string;
  phone: string;
  token: string;
  expires_at: string;
  used: boolean;
  created_at: string;
}
