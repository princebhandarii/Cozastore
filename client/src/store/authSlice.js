import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout as firebaseLogout,
} from "../firebase/config";
import { fetchMyProfile } from "../services/authService";

// Loads/creates the MongoDB profile for the currently signed-in Firebase user.
export const syncProfile = createAsyncThunk(
  "auth/syncProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchMyProfile();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async ({ name, email, password }, { dispatch, rejectWithValue }) => {
    try {
      await registerWithEmail(name, email, password);
      return await dispatch(syncProfile()).unwrap();
    } catch (err) {
      return rejectWithValue(err.message || "Registration failed");
    }
  }
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { dispatch, rejectWithValue }) => {
    try {
      await loginWithEmail(email, password);
      return await dispatch(syncProfile()).unwrap();
    } catch (err) {
      return rejectWithValue(err.message || "Login failed");
    }
  }
);

export const loginUserWithGoogle = createAsyncThunk(
  "auth/loginUserWithGoogle",
  async (_, { dispatch, rejectWithValue }) => {
    try {
      await loginWithGoogle();
      return await dispatch(syncProfile()).unwrap();
    } catch (err) {
      return rejectWithValue(err.message || "Google sign-in failed");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await firebaseLogout();
  return true;
});

const initialState = {
  firebaseReady: false, // becomes true once onAuthStateChanged fires once
  isAuthenticated: false,
  profile: null, // MongoDB user document
  status: "idle", // idle | loading | succeeded | failed
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setFirebaseReady(state, action) {
      state.firebaseReady = true;
      state.isAuthenticated = Boolean(action.payload);
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncProfile.pending, (state) => {
        state.status = "loading";
      })
      .addCase(syncProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.profile = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(syncProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      // NOTE: every addCase must come BEFORE the first addMatcher (RTK rule).
      .addCase(logoutUser.fulfilled, (state) => {
        state.profile = null;
        state.isAuthenticated = false;
        state.status = "idle";
      })
      .addMatcher(
        (action) =>
          [registerUser, loginUser, loginUserWithGoogle].some(
            (thunk) => thunk.pending.type === action.type
          ),
        (state) => {
          state.status = "loading";
          state.error = null;
        }
      )
      .addMatcher(
        (action) =>
          [registerUser, loginUser, loginUserWithGoogle].some(
            (thunk) => thunk.rejected.type === action.type
          ),
        (state, action) => {
          state.status = "failed";
          state.error = action.payload;
        }
      );
  },
});

export const { setFirebaseReady, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
