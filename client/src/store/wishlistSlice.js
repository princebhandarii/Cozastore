import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { getWishlistApi, addToWishlistApi, removeFromWishlistApi } from "../services/cartService";
import { logoutUser } from "./authSlice";

const wrap = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  });

export const fetchWishlist = wrap("wishlist/fetch", () => getWishlistApi());
export const addToWishlist = wrap("wishlist/add", (id) => addToWishlistApi(id));
export const removeFromWishlist = wrap("wishlist/remove", (id) => removeFromWishlistApi(id));

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState: { items: [], status: "idle" },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchWishlist.pending, (s) => { s.status = "loading"; })
      .addCase(logoutUser.fulfilled, () => ({ items: [], status: "idle" }));
    [fetchWishlist, addToWishlist, removeFromWishlist].forEach((thunk) =>
      builder.addCase(thunk.fulfilled, (s, a) => { s.items = a.payload; s.status = "succeeded"; })
    );
  },
});

export default wishlistSlice.reducer;
