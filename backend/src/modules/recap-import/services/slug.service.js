export function slugifyForPath(text, { maxLength } = {}) {
  let slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (maxLength && slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+$/g, '');
  }

  return slug;
}
