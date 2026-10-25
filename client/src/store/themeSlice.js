import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "coza_theme";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyThemeToDom = (mode) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", mode);
};

const initialMode = getInitialTheme();
applyThemeToDom(initialMode);

const themeSlice = createSlice({
  name: "theme",
  initialState: { mode: initialMode },
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, state.mode);
      applyThemeToDom(state.mode);
    },
    setTheme(state, action) {
      state.mode = action.payload;
      window.localStorage.setItem(STORAGE_KEY, state.mode);
      applyThemeToDom(state.mode);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
