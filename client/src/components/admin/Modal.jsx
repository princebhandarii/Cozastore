import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Modal({ title, onClose, children, wide }) {
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6`}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
