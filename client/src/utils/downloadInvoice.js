import api from "../services/api";

// The invoice endpoint needs the auth header, so a plain <a href> can't be
// used: fetch the PDF as a blob and hand it to the browser.
export const downloadInvoice = async (path) => {
  const res = await api.get(path, { responseType: "blob" });
  const disposition = res.headers["content-disposition"] || "";
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] || "invoice.pdf";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
