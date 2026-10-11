// Small helper around the standard WordPress REST API (/wp-json/wp/v2).

/**
 * @typedef {{
 *   id: number,
 *   slug: string,
 *   date: string,
 *   title: { rendered: string },
 *   excerpt: { rendered: string },
 *   content: { rendered: string },
 *   _embedded?: {
 *     author?: { name: string }[],
 *     "wp:featuredmedia"?: {
 *       source_url?: string,
 *       alt_text?: string,
 *       media_details?: { sizes?: Record<string, { source_url: string }> }
 *     }[]
 *   }
 * }} WPPost
 */

const SITE = (import.meta.env.WP_SITE_URL ?? "").replace(/\/$/, "");

if (!SITE) {
  throw new Error("WP_SITE_URL is not set. Copy .env.example to .env and set it.");
}
const API = `${SITE}/wp-json/wp/v2`;

async function wpFetch(path, params = {}) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`WordPress API error ${res.status} for ${url}`);
  }
  return res;
}

/**
 * Fetch every published post (follows WordPress pagination, 100 per request).
 * @returns {Promise<WPPost[]>}
 */
export async function getAllPosts() {
  const first = await wpFetch("/posts", { per_page: 100, page: 1, _embed: 1 });
  const totalPages = Number(first.headers.get("X-WP-TotalPages") ?? 1);
  /** @type {WPPost[]} */
  const posts = await first.json();

  for (let page = 2; page <= totalPages; page++) {
    const res = await wpFetch("/posts", { per_page: 100, page, _embed: 1 });
    posts.push(...(await res.json()));
  }
  return posts;
}

/**
 * Pull the handy bits out of an embedded post object.
 * @param {WPPost} post
 */
export function postMeta(post) {
  const media = post._embedded?.["wp:featuredmedia"]?.[0];
  return {
    image: media?.media_details?.sizes?.large?.source_url ?? media?.source_url ?? null,
    imageAlt: media?.alt_text ?? "",
    author: post._embedded?.author?.[0]?.name ?? null,
    date: new Date(post.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}