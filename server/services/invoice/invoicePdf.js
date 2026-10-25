import PDFDocument from "pdfkit";

// Standard PDF fonts can't draw the rupee sign, so amounts are printed as "Rs.".
const money = (n) => `Rs. ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const payLabel = (p) => {
  if (p.method === "COD") {
    const c = p.cod || {};
    return `Cash on delivery - Rs. ${c.tokenAmount} paid online, Rs. ${c.remainingAmount} ${c.remainingPaid ? "collected on delivery" : "due on delivery"}`;
  }
  return `Online (Razorpay) - ${p.status.toLowerCase().replaceAll("_", " ")}`;
};

// Streams the invoice into `stream` (an HTTP response or file stream).
export const renderInvoicePdf = (model, stream) => {
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Invoice ${model.invoice.number}`, Author: model.store.name } });
  doc.pipe(stream);
  const left = 48;
  const right = doc.page.width - 48;
  const width = right - left;

  // Header
  doc.font("Helvetica-Bold").fontSize(20).text(model.store.name, left, 48);
  doc.font("Helvetica").fontSize(9).fillColor("#555");
  [model.store.address, model.store.gstin && `GSTIN: ${model.store.gstin}`, [model.store.email, model.store.phone].filter(Boolean).join("  |  ")]
    .filter(Boolean).forEach((line) => doc.text(line, left, doc.y));
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(16).text("INVOICE", left, 48, { width, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#333")
    .text(`Invoice no: ${model.invoice.number}`, left, 72, { width, align: "right" })
    .text(`Invoice date: ${date(model.invoice.issuedAt)}`, left, doc.y, { width, align: "right" })
    .text(`Order no: ${model.orderNumber}`, left, doc.y, { width, align: "right" })
    .text(`Order date: ${date(model.orderDate)}`, left, doc.y, { width, align: "right" });

  // Bill / ship to
  let y = Math.max(doc.y, 130) + 14;
  doc.moveTo(left, y).lineTo(right, y).strokeColor("#ddd").stroke();
  y += 10;
  const c = model.customer;
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(10).text("Billing / shipping address", left, y);
  doc.font("Helvetica").fontSize(9).fillColor("#333").text(
    [c.fullName, c.addressLine1, c.addressLine2, c.landmark, `${c.city}, ${c.state} - ${c.pincode}`, `Phone: ${c.phone}`].filter(Boolean).join("\n"),
    left, y + 14, { width: width / 2 }
  );
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("Payment", left + width / 2, y);
  doc.font("Helvetica").fontSize(9).fillColor("#333").text(payLabel(model.payment), left + width / 2, y + 14, { width: width / 2 });

  // Items table
  y = Math.max(doc.y, y + 70) + 16;
  const col = { item: left, qty: left + 300, price: left + 350, total: left + 430 };
  const header = () => {
    doc.rect(left, y, width, 20).fill("#f2f2f2");
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(9);
    doc.text("Item / SKU", col.item + 6, y + 6);
    doc.text("Qty", col.qty, y + 6, { width: 40, align: "right" });
    doc.text("Unit price", col.price, y + 6, { width: 70, align: "right" });
    doc.text("Amount", col.total, y + 6, { width: right - col.total - 6, align: "right" });
    y += 26;
  };
  header();
  doc.font("Helvetica").fontSize(9);
  for (const it of model.items) {
    if (y > doc.page.height - 200) { doc.addPage(); y = 48; header(); doc.font("Helvetica").fontSize(9); }
    doc.fillColor("#000").text(it.name, col.item + 6, y, { width: 285 });
    const nameBottom = doc.y;
    doc.fillColor("#666").text(`${it.sku || ""}${it.options ? `  ·  ${it.options}` : ""}`, col.item + 6, nameBottom, { width: 285 });
    const rowBottom = doc.y;
    doc.fillColor("#000");
    doc.text(String(it.quantity), col.qty, y, { width: 40, align: "right" });
    doc.text(money(it.unitPrice), col.price, y, { width: 70, align: "right" });
    doc.text(money(it.lineTotal), col.total, y, { width: right - col.total - 6, align: "right" });
    y = rowBottom + 8;
    doc.moveTo(left, y - 3).lineTo(right, y - 3).strokeColor("#eee").stroke();
  }

  // Totals
  if (y > doc.page.height - 200) { doc.addPage(); y = 48; }
  y += 6;
  const row = (label, value, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9).fillColor("#000");
    doc.text(label, left + 250, y, { width: 150 });
    doc.text(value, col.total, y, { width: right - col.total - 6, align: "right" });
    y += bold ? 20 : 15;
  };
  row("Subtotal", money(model.subtotal));
  if (model.discount > 0) row(`Discount${model.couponCode ? ` (${model.couponCode})` : ""}`, `- ${money(model.discount)}`);
  row("Shipping", model.shippingCharge ? money(model.shippingCharge) : "Free");
  doc.moveTo(left + 250, y).lineTo(right, y).strokeColor("#000").stroke();
  y += 6;
  row("Total (incl. taxes)", money(model.totalAmount), true);

  if (model.gst) {
    const g = model.gst;
    y += 4;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text("Tax summary (prices are tax-inclusive)", left, y);
    y += 14;
    doc.font("Helvetica").fontSize(9).fillColor("#333");
    const tax = [`Taxable value: ${money(g.taxable)}`, g.igst ? `IGST @ ${g.ratePercent}%: ${money(g.igst)}` : `CGST @ ${g.ratePercent / 2}%: ${money(g.cgst)}   SGST @ ${g.ratePercent / 2}%: ${money(g.sgst)}`];
    tax.forEach((t) => { doc.text(t, left, y); y += 13; });
  }

  doc.font("Helvetica").fontSize(8).fillColor("#888").text("This is a computer-generated invoice and does not require a signature.", left, doc.page.height - 60, { width, align: "center" });
  doc.end();
};
