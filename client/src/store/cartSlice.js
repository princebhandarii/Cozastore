import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getCartApi,
  addToCartApi,
  updateCartItemApi,
  removeCartItemApi,
  clearCartApi,
} from "../services/cartService";
import { logoutUser } from "./authSlice";

const wrap = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue({ message: err.message, code: err.code });
    }
  });

export const fetchCart = wrap("cart/fetch", () => getCartApi());
export const addToCart = wrap("cart/add", (payload) => addToCartApi(payload));
export const updateCartItem = wrap("cart/update", ({ itemId, quantity }) => updateCartItemApi(itemId, quantity));
export const removeCartItem = wrap("cart/remove", (itemId) => removeCartItemApi(itemId));
export const clearCart = wrap("cart/clear", () => clearCartApi());

const initialState = { items: [], subtotal: 0, itemCount: 0, status: "idle", error: null };

const applyCart = (state, action) => {
  state.items = action.payload.items;
  state.subtotal = action.payload.subtotal;
  state.itemCount = action.payload.itemCount;
  state.status = "succeeded";
  state.error = null;
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: { clearCartError: (state) => { state.error = null; } },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (s) => { s.status = "loading"; })
      .addCase(fetchCart.fulfilled, applyCart)
      .addCase(addToCart.fulfilled, applyCart)
      .addCase(updateCartItem.fulfilled, applyCart)
      .addCase(removeCartItem.fulfilled, applyCart)
      .addCase(clearCart.fulfilled, applyCart)
      .addCase(logoutUser.fulfilled, () => initialState);
    [fetchCart, addToCart, updateCartItem, removeCartItem, clearCart].forEach((thunk) =>
      builder.addCase(thunk.rejected, (s, a) => { s.status = "failed"; s.error = a.payload?.message; })
    );
  },
});

export const { clearCartError } = cartSlice.actions;
export default cartSlice.reducer;
