/**
 * Backfill instagram_permalink for published posts that have an instagram_post_id
 * but no permalink stored yet.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-permalinks.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Find published posts with an instagram_post_id but no permalink
  const { data: posts, error } = await db
    .from("posts")
    .select("id, profile_id, organization_id, instagram_post_id")
    .eq("status", "published")
    .not("instagram_post_id", "is", null)
    .is("instagram_permalink", null);

  if (error) {
    console.error("Failed to fetch posts:", error.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log("No posts need backfilling.");
    return;
  }

  console.log(`Found ${posts.length} post(s) to backfill.\n`);

  // Get unique org IDs from posts and fetch their access tokens
  const orgIds = [...new Set(posts.map((p) => p.organization_id).filter(Boolean))];
  const { data: connections } = await db
    .from("instagram_connections")
    .select("organization_id, access_token")
    .in("organization_id", orgIds);

  const tokenMap = new Map<string, string>();
  for (const conn of connections || []) {
    tokenMap.set(conn.organization_id, conn.access_token);
  }

  let updated = 0;
  let failed = 0;

  for (const post of posts) {
    const accessToken = post.organization_id ? tokenMap.get(post.organization_id) : null;
    if (!accessToken) {
      console.log(`  SKIP ${post.id} — no Instagram connection for org ${post.organization_id}`);
      failed++;
      continue;
    }

    try {
      const res = await fetch(
        `https://graph.instagram.com/v21.0/${post.instagram_post_id}?fields=permalink&access_token=${accessToken}`,
      );
      const data = await res.json();

      if (data.error) {
        console.log(`  FAIL ${post.id} — ${data.error.message}`);
        failed++;
        continue;
      }

      if (!data.permalink) {
        console.log(`  FAIL ${post.id} — no permalink returned`);
        failed++;
        continue;
      }

      await db.from("posts").update({ instagram_permalink: data.permalink }).eq("id", post.id);
      console.log(`  OK   ${post.id} — ${data.permalink}`);
      updated++;
    } catch (err) {
      console.log(`  FAIL ${post.id} — ${err}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main();
