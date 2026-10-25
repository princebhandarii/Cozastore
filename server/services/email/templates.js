import { wrapEmail, button, money } from "./layout.js";
import { env } from "../../config/env.js";

const orderUrl = (order) => `${env.clientUrl}/account/orders/${order._id}`;
const trackUrl = (order) => `${env.clientUrl}/account/orders/${order._id}/track`;
const returnUrl = (ret) => `${env.clientUrl}/account/returns/${ret._id}`;

const itemsList = (items) =>
  items
    .map((i) => `<tr><td style="padding:6px 0;">${i.name}${[i.size, i.color].filter(Boolean).length ? ` (${[i.size, i.color].filter(Boolean).join(" / ")})` : ""} × ${i.quantity}</td><td style="padding:6px 0;text-align:right;">${money(i.lineTotal)}</td></tr>`)
    .join("");

const orderBody = (order, intro) => `
  <p style="font-size:16px;margin:0 0 16px;">${intro}</p>
  <p style="font-size:14px;color:#555;margin:0 0 20px;">Order <strong>${order.orderNumber}</strong></p>
  <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse;">${itemsList(order.items)}</table>
  <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #eee;margin-top:8px;padding-top:8px;">
    <tr><td style="padding-top:10px;">Total</td><td style="padding-top:10px;text-align:right;font-weight:700;">${money(order.totalAmount)}</td></tr>
  </table>
  <div style="margin-top:24px;">${button(orderUrl(order), "View order")}</div>
`;

export const welcomeEmail = (user) => ({
  subject: `Welcome to ${env.store.name}`,
  html: wrapEmail({ title: "Welcome", preheader: "Thanks for joining us", bodyHtml: `
    <p style="font-size:16px;">Hi ${user.name || "there"},</p>
    <p style="font-size:14px;color:#555;">Welcome to ${env.store.name} — we're glad you're here. Browse the collection whenever you're ready.</p>
    <div style="margin-top:20px;">${button(`${env.clientUrl}/shop`, "Start shopping")}</div>
  ` }),
});

export const orderPlacedEmail = (order) => ({
  subject: `Order placed — ${order.orderNumber}`,
  html: wrapEmail({ title: "Order placed", preheader: `Your order ${order.orderNumber} was placed`, bodyHtml: orderBody(order, "Thanks for your order! Here's what you ordered:") }),
});

export const paymentSuccessEmail = (order) => ({
  subject: `Payment received — ${order.orderNumber}`,
  html: wrapEmail({ title: "Payment received", preheader: "Your payment was successful", bodyHtml: orderBody(order, "Payment received — your order is confirmed.") }),
});

export const codPendingEmail = (order) => ({
  subject: `Order received — awaiting confirmation (${order.orderNumber})`,
  html: wrapEmail({ title: "COD order pending", preheader: "We're confirming your cash-on-delivery order", bodyHtml: `
    <p style="font-size:16px;">We've received your cash-on-delivery order and your ${money(order.cod.tokenAmount)} token payment.</p>
    <p style="font-size:14px;color:#555;">We'll confirm it shortly. You'll pay ${money(order.cod.remainingAmount)} in cash when it arrives.</p>
    ${orderBody(order, "")}
  ` }),
});

export const codConfirmedEmail = (order) => ({
  subject: `Order confirmed — ${order.orderNumber}`,
  html: wrapEmail({ title: "COD confirmed", preheader: "Your cash-on-delivery order is confirmed", bodyHtml: orderBody(order, `Good news — your cash-on-delivery order is confirmed. Keep ${money(order.cod.remainingAmount)} ready for delivery.`) }),
});

export const codRejectedEmail = (order) => ({
  subject: `Order could not be confirmed — ${order.orderNumber}`,
  html: wrapEmail({ title: "COD rejected", preheader: "We could not confirm your order", bodyHtml: `
    <p style="font-size:16px;">We're sorry — we couldn't confirm your cash-on-delivery order.</p>
    <p style="font-size:14px;color:#555;">Order <strong>${order.orderNumber}</strong></p>
    ${order.cod.rejectionReason ? `<p style="font-size:14px;color:#555;">Reason: ${order.cod.rejectionReason}</p>` : ""}
    <p style="font-size:14px;color:#555;">If a token refund is due, it will be processed automatically and you'll be notified.</p>
    <div style="margin-top:20px;">${button(orderUrl(order), "View order")}</div>
  ` }),
});

export const shippedEmail = (order) => ({
  subject: `Order shipped — ${order.orderNumber}`,
  html: wrapEmail({ title: "Order shipped", preheader: "Your order is on its way", bodyHtml: `
    <p style="font-size:16px;">Your order has shipped!</p>
    <p style="font-size:14px;color:#555;">Order <strong>${order.orderNumber}</strong></p>
    ${order.shipping?.courier ? `<p style="font-size:14px;color:#555;">Courier: ${order.shipping.courier}${order.shipping.trackingNumber ? ` · Tracking #: ${order.shipping.trackingNumber}` : ""}</p>` : ""}
    <div style="margin-top:20px;">${button(trackUrl(order), "Track order")}</div>
  ` }),
});

export const outForDeliveryEmail = (order) => ({
  subject: `Out for delivery — ${order.orderNumber}`,
  html: wrapEmail({ title: "Out for delivery", preheader: "Your order is out for delivery", bodyHtml: `
    <p style="font-size:16px;">Your order is out for delivery today.</p>
    <p style="font-size:14px;color:#555;">Order <strong>${order.orderNumber}</strong></p>
    ${order.paymentMethod === "COD" ? `<p style="font-size:14px;color:#555;">Please keep ${money(order.cod.remainingAmount)} ready for the courier.</p>` : ""}
    <div style="margin-top:20px;">${button(trackUrl(order), "Track order")}</div>
  ` }),
});

export const deliveredEmail = (order) => ({
  subject: `Delivered — ${order.orderNumber}`,
  html: wrapEmail({ title: "Delivered", preheader: "Your order has been delivered", bodyHtml: `
    <p style="font-size:16px;">Your order was delivered. We hope you love it!</p>
    <p style="font-size:14px;color:#555;">Order <strong>${order.orderNumber}</strong></p>
    <div style="margin-top:20px;">${button(orderUrl(order), "Leave a review")}</div>
  ` }),
});

export const cancelledEmail = (order, refundNote) => ({
  subject: `Order cancelled — ${order.orderNumber}`,
  html: wrapEmail({ title: "Order cancelled", preheader: "Your order has been cancelled", bodyHtml: `
    <p style="font-size:16px;">Your order ${order.orderNumber} has been cancelled.</p>
    ${refundNote ? `<p style="font-size:14px;color:#555;">${refundNote}</p>` : ""}
    <div style="margin-top:20px;">${button(orderUrl(order), "View order")}</div>
  ` }),
});

export const returnRequestedEmail = (ret, order) => ({
  subject: `Return requested — ${order.orderNumber}`,
  html: wrapEmail({ title: "Return requested", preheader: "We've received your return request", bodyHtml: `
    <p style="font-size:16px;">We've received your return request for order ${order.orderNumber}.</p>
    <p style="font-size:14px;color:#555;">Estimated refund: ${money(ret.refundAmount)}. We'll review it and be in touch.</p>
    <div style="margin-top:20px;">${button(returnUrl(ret), "View return")}</div>
  ` }),
});

export const returnDecisionEmail = (ret, order) => ({
  subject: ret.status === "RETURN_APPROVED" ? `Return approved — ${order.orderNumber}` : `Return not approved — ${order.orderNumber}`,
  html: wrapEmail({ title: "Return update", preheader: "Update on your return request", bodyHtml: `
    <p style="font-size:16px;">${ret.status === "RETURN_APPROVED" ? "Your return has been approved. We'll arrange pickup shortly." : "Your return request could not be approved."}</p>
    <p style="font-size:14px;color:#555;">Order <strong>${order.orderNumber}</strong></p>
    ${ret.adminNote ? `<p style="font-size:14px;color:#555;">Note: ${ret.adminNote}</p>` : ""}
    <div style="margin-top:20px;">${button(returnUrl(ret), "View return")}</div>
  ` }),
});

export const refundInitiatedEmail = (ret, order) => ({
  subject: `Refund initiated — ${order.orderNumber}`,
  html: wrapEmail({ title: "Refund initiated", preheader: "Your refund is on its way", bodyHtml: `
    <p style="font-size:16px;">A refund of ${money(ret.refundAmount)} has been initiated for order ${order.orderNumber}.</p>
    <p style="font-size:14px;color:#555;">Online refunds usually take 5-7 working days to reflect.</p>
    <div style="margin-top:20px;">${button(returnUrl(ret), "View return")}</div>
  ` }),
});

export const refundCompletedEmail = (ret, order) => ({
  subject: `Refund completed — ${order.orderNumber}`,
  html: wrapEmail({ title: "Refund completed", preheader: "Your refund is complete", bodyHtml: `
    <p style="font-size:16px;">Your refund of ${money(ret.refundAmount)} for order ${order.orderNumber} is complete.</p>
    <div style="margin-top:20px;">${button(returnUrl(ret), "View return")}</div>
  ` }),
});
