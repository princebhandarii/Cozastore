import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import * as templates from "./templates.js";

let transporter;

const getTransporter = () => {
  if (transporter) return transporter;

  if (env.email.provider === "smtp") {
    if (!env.email.host || !env.email.user || !env.email.password) {
      throw new Error("EMAIL_HOST, EMAIL_USER and EMAIL_PASSWORD must be set for EMAIL_PROVIDER=smtp");
    }
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: { user: env.email.user, pass: env.email.password },
    });
    return transporter;
  }

  // DEVELOPMENT-ONLY: prints the email instead of sending it, and refuses to
  // run in production so a real customer email is never silently "sent" to
  // nowhere. Configure EMAIL_HOST/USER/PASSWORD (any SMTP provider - Gmail
  // app password, SendGrid, Mailgun, AWS SES, ...) to send real email.
  if (env.nodeEnv === "production") {
    throw new Error("No email provider configured (EMAIL_PROVIDER=console is development-only). Set EMAIL_HOST/EMAIL_USER/EMAIL_PASSWORD.");
  }
  transporter = nodemailer.createTransport({ jsonTransport: true });
  return transporter;
};

// Never lets an email failure break the order/return/COD flow that triggered
// it - every call site awaits this and it never throws.
const send = async (to, { subject, html }) => {
  try {
    const info = await getTransporter().sendMail({ from: env.email.from, to, subject, html });
    if (env.email.provider !== "smtp") {
      // eslint-disable-next-line no-console
      console.log(`\n[DEV EMAIL - not actually sent] to ${to}: "${subject}"\n`);
    }
    return info;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Failed to send email to ${to} ("${subject}"):`, err.message);
    return null;
  }
};

const emailOf = (order) => order.user?.email || order.userEmail;

// One wrapper per template. `order.user` must be populated with at least
// `email` for these to have somewhere to send to - callers pass the plain
// address instead where that's more convenient (see call sites).
export const sendWelcomeEmail = (user) => send(user.email, templates.welcomeEmail(user));
export const sendOrderPlacedEmail = (order, to) => send(to, templates.orderPlacedEmail(order));
export const sendPaymentSuccessEmail = (order, to) => send(to, templates.paymentSuccessEmail(order));
export const sendCodPendingEmail = (order, to) => send(to, templates.codPendingEmail(order));
export const sendCodConfirmedEmail = (order, to) => send(to, templates.codConfirmedEmail(order));
export const sendCodRejectedEmail = (order, to) => send(to, templates.codRejectedEmail(order));
export const sendShippedEmail = (order, to) => send(to, templates.shippedEmail(order));
export const sendOutForDeliveryEmail = (order, to) => send(to, templates.outForDeliveryEmail(order));
export const sendDeliveredEmail = (order, to) => send(to, templates.deliveredEmail(order));
export const sendCancelledEmail = (order, to, refundNote) => send(to, templates.cancelledEmail(order, refundNote));
export const sendReturnRequestedEmail = (ret, order, to) => send(to, templates.returnRequestedEmail(ret, order));
export const sendReturnDecisionEmail = (ret, order, to) => send(to, templates.returnDecisionEmail(ret, order));
export const sendRefundInitiatedEmail = (ret, order, to) => send(to, templates.refundInitiatedEmail(ret, order));
export const sendRefundCompletedEmail = (ret, order, to) => send(to, templates.refundCompletedEmail(ret, order));
