import mongoose from "mongoose";

// Atomic sequence generator (used for invoice numbers).
const counterSchema = new mongoose.Schema({ key: { type: String, required: true, unique: true }, seq: { type: Number, default: 0 } });
const Counter = mongoose.model("Counter", counterSchema);

export const nextSequence = async (key) => {
  const doc = await Counter.findOneAndUpdate({ key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return doc.seq;
};
export default Counter;
