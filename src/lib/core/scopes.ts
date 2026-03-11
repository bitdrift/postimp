export const REQUIRED_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];

export const REQUIRED_FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
];

export function needsReauth(grantedScopes: string[] | null, requiredScopes: string[]): boolean {
  if (!grantedScopes) return true;
  return requiredScopes.some((s) => !grantedScopes.includes(s));
}
