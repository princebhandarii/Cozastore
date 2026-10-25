// Populates MongoDB Atlas with demo categories + 20+ products so the
// catalog is browsable immediately after Phase 2. Uses placeholder image
// URLs (picsum.photos) rather than real Cloudinary uploads - swap these
// out via the admin product editor once Cloudinary is configured.
//
// Run with: npm run seed  (from server/)
import "../config/env.js";
import { connectDB } from "../config/db.js";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Coupon from "../models/Coupon.js";
import SiteSettings from "../models/SiteSettings.js";
import { generateUniqueSlug } from "../utils/slug.js";

const categoryDefs = [
  { name: "Men's Clothing", description: "Shirts, tees, and outerwear" },
  { name: "Women's Clothing", description: "Dresses, tops, and essentials" },
  { name: "Footwear", description: "Sneakers, boots, and sandals" },
  { name: "Accessories", description: "Bags, belts, and watches" },
];

const brands = ["Coza", "Nordic", "Urbane", "Fielder", "Maison"];
const productNames = [
  "Classic Oxford Shirt", "Relaxed Fit Tee", "Wool Overcoat", "Slim Chino Trousers",
  "Linen Summer Dress", "Cropped Denim Jacket", "Pleated Midi Skirt", "Cashmere Sweater",
  "Leather High-Top Sneaker", "Suede Chelsea Boot", "Canvas Low-Top", "Trail Running Shoe",
  "Minimalist Tote Bag", "Full-Grain Leather Belt", "Automatic Chrono Watch", "Wool Beanie",
  "Merino Crewneck", "Tailored Blazer", "Straight Leg Jeans", "Quilted Vest",
  "Ribbed Turtleneck", "Utility Cargo Pants",
];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randomBetween(0, arr.length - 1)];

const run = async () => {
  await connectDB();

  await Category.deleteMany({});
  await Product.deleteMany({});
  await Coupon.deleteMany({});

  const categories = [];
  for (const def of categoryDefs) {
    const slug = await generateUniqueSlug(Category, def.name);
    categories.push(await Category.create({ ...def, slug }));
  }

  let seeded = 0;
  for (const name of productNames) {
    const category = pick(categories);
    const brand = pick(brands);
    const price = randomBetween(799, 8999);
    const hasDiscount = Math.random() > 0.6;
    const stock = randomBetween(0, 120);
    const slug = await generateUniqueSlug(Product, name);
    const sku = `SKU-${Date.now()}-${seeded}`;

    const withVariants = Math.random() > 0.4;
    const variants = withVariants
      ? ["S", "M", "L", "XL"].map((size, i) => ({
          size,
          sku: `${sku}-${size}`,
          price,
          stock: randomBetween(0, 40),
          image: null,
        }))
      : [];

    await Product.create({
      name,
      slug,
      description:
        `${name} from ${brand} — a premium, everyday piece designed with restraint and built to last. ` +
        `Made from carefully sourced materials for a refined, minimal look.`,
      shortDescription: `${brand} ${name.toLowerCase()}`,
      brand,
      category: category._id,
      images: [
        { url: `https://picsum.photos/seed/${slug}-1/800/1000`, publicId: null },
        { url: `https://picsum.photos/seed/${slug}-2/800/1000`, publicId: null },
      ],
      price,
      compareAtPrice: hasDiscount ? Math.round(price * 1.25) : null,
      discount: hasDiscount ? randomBetween(10, 30) : 0,
      stock,
      sku,
      variants,
      specifications: [
        { key: "Material", value: pick(["Cotton", "Wool blend", "Linen", "Leather", "Canvas"]) },
        { key: "Fit", value: pick(["Regular", "Slim", "Relaxed", "Oversized"]) },
      ],
      ratings: Number((Math.random() * 2 + 3).toFixed(1)),
      reviewCount: randomBetween(0, 240),
      isFeatured: Math.random() > 0.75,
    });
    seeded += 1;
  }

  // Demo COD configuration (change it any time from the admin COD page).
  await SiteSettings.findOneAndUpdate(
    { key: "main" },
    { $set: { cod: { enabled: true, minOrderAmount: 500, maxOrderAmount: 20000, tokenType: "fixed", tokenValue: 100, otpRequired: false, cancellationPolicy: "refundable" } } },
    { upsert: true }
  );

  const inOneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await Coupon.create([
    { code: "WELCOME10", description: "10% off, up to ₹500", discountType: "percentage", discountValue: 10, minimumOrderValue: 999, maximumDiscount: 500, expiryDate: inOneYear, perUserLimit: 1 },
    { code: "FLAT200", description: "Flat ₹200 off orders above ₹1500", discountType: "fixed", discountValue: 200, minimumOrderValue: 1500, expiryDate: inOneYear, perUserLimit: 3 },
    { code: "EXPIRED5", description: "Expired coupon for testing", discountType: "percentage", discountValue: 5, expiryDate: new Date(Date.now() - 86400000) },
  ]);

  // eslint-disable-next-line no-console
  console.log(`Seeded ${categories.length} categories and ${seeded} products.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
