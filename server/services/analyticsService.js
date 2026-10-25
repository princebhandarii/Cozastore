import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import ReturnRequest from "../models/ReturnRequest.js";
import { istDayStart, fillDailySeries } from "../utils/dates.js";
import { getLowStockRows } from "./inventoryQueryService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// DEFINITIONS (shown to admins in the UI):
//  * "Committed" order  = one that was paid/booked at some point (reached
//    CONFIRMED, or COD token paid). Unpaid abandoned checkouts never count.
//  * Revenue = full value of orders that reached CONFIRMED and are not
//    cancelled, minus refunds completed through returns. For COD it includes
//    the balance due on delivery.
const COMMITTED = { "timeline.status": { $in: ["CONFIRMED", "PENDING_COD_CONFIRMATION"] } };
const REVENUE_MATCH = { confirmedAt: { $ne: null }, status: { $ne: "CANCELLED" } };

const sumOf = (rows) => rows[0]?.total || 0;

export const getDashboardStats = async () => {
  const todayStart = new Date(istDayStart());
  const [gross, today, refunds, totalOrders, pending, delivered, cancelled, returnRequests, customers, products, lowStock, recentOrders] = await Promise.all([
    Order.aggregate([{ $match: REVENUE_MATCH }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    Order.aggregate([{ $match: { status: { $ne: "CANCELLED" }, confirmedAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    ReturnRequest.aggregate([{ $match: { status: "REFUNDED" } }, { $group: { _id: null, total: { $sum: "$refundAmount" } } }]),
    Order.countDocuments(COMMITTED),
    Order.countDocuments({ status: { $in: ["PENDING_COD_CONFIRMATION", "CONFIRMED", "PROCESSING"] } }),
    Order.countDocuments({ status: "DELIVERED" }),
    Order.countDocuments({ ...COMMITTED, status: "CANCELLED" }),
    ReturnRequest.countDocuments({ status: "RETURN_REQUESTED" }),
    User.countDocuments({ role: "customer" }),
    Product.countDocuments({ isActive: true }),
    getLowStockRows(5),
    Order.find(COMMITTED).populate("user", "name email").sort({ createdAt: -1 }).limit(6).select("orderNumber status totalAmount paymentMethod createdAt user"),
  ]);

  const grossRevenue = sumOf(gross);
  const refunded = sumOf(refunds);
  return {
    cards: {
      totalRevenue: grossRevenue - refunded,
      grossRevenue,
      refundedViaReturns: refunded,
      todayRevenue: sumOf(today),
      totalOrders,
      pendingOrders: pending,
      deliveredOrders: delivered,
      cancelledOrders: cancelled,
      openReturnRequests: returnRequests,
      totalCustomers: customers,
      totalProducts: products,
      lowStockProducts: lowStock.length,
    },
    lowStock: lowStock.slice(0, 6),
    recentOrders,
  };
};

export const getAnalytics = async (days = 30) => {
  const startMs = istDayStart() - (days - 1) * DAY_MS;
  const base = [{ $match: { status: { $ne: "CANCELLED" }, confirmedAt: { $gte: new Date(startMs) } } }];

  const [facets] = await Order.aggregate([
    ...base,
    {
      $facet: {
        daily: [
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$confirmedAt", timezone: "Asia/Kolkata" } }, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
        ],
        topProducts: [
          { $unwind: "$items" },
          { $group: { _id: "$items.product", name: { $first: "$items.name" }, units: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" } } },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
        ],
        categories: [
          { $unwind: "$items" },
          { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "p" } },
          { $lookup: { from: "categories", localField: "p.category", foreignField: "_id", as: "c" } },
          { $group: { _id: { $ifNull: [{ $arrayElemAt: ["$c.name", 0] }, "Uncategorised"] }, revenue: { $sum: "$items.lineTotal" }, units: { $sum: "$items.quantity" } } },
          { $sort: { revenue: -1 } },
        ],
        paymentMethods: [{ $group: { _id: "$paymentMethod", orders: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } }],
      },
    },
  ]);

  const daily = fillDailySeries(startMs, days, facets?.daily || []);
  return {
    days,
    daily,
    totals: { revenue: daily.reduce((n, d) => n + d.revenue, 0), orders: daily.reduce((n, d) => n + d.orders, 0) },
    topProducts: (facets?.topProducts || []).map((p) => ({ productId: p._id, name: p.name, units: p.units, revenue: p.revenue })),
    categories: (facets?.categories || []).map((c) => ({ name: c._id, revenue: c.revenue, units: c.units })),
    paymentMethods: (facets?.paymentMethods || []).map((m) => ({ method: m._id, orders: m.orders, revenue: m.revenue })),
  };
};
