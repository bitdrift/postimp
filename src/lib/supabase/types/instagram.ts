export interface InstagramConnection {
  id: string;
  organization_id: string;
  user_id: string | null;
  instagram_user_id: string;
  access_token: string;
  token_expires_at: string | null;
  instagram_username: string | null;
  granted_scopes: string[] | null;
  created_at: string;
  updated_at: string;
}
