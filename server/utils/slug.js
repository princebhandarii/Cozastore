import slugify from "slugify";

// Generates a URL-safe slug and, if it collides with an existing document,
// appends -2, -3, ... until it's unique. `Model` must have a `slug` field.
export const generateUniqueSlug = async (Model, text, excludeId = null) => {
  const base = slugify(text, { lower: true, strict: true });
  let slug = base;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Model.exists(query);
    if (!exists) return slug;
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
};
