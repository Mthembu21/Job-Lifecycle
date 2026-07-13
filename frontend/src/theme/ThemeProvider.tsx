import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme } from "@mui/material";
import { EPIROC_BLACK, EPIROC_YELLOW } from "./epirocBrand";

type Mode = "light" | "dark";

interface ThemeModeContextValue {
  mode: Mode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

const STORAGE_KEY = "job-lifecycle.theme-mode";

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(STORAGE_KEY) as Mode) || "light");

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: EPIROC_YELLOW, contrastText: EPIROC_BLACK },
          secondary: { main: EPIROC_BLACK, contrastText: "#FFFFFF" },
          success: { main: "#1E8E3E" },
          warning: { main: "#F4A100" },
          error: { main: "#D93025" },
          background:
            mode === "light"
              ? { default: "#F4F6F8", paper: "#FFFFFF" }
              : { default: "#0F1417", paper: "#171D21" },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: ["Inter", "Roboto", "Segoe UI", "Arial", "sans-serif"].join(","),
        },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: { backgroundImage: "none" },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used within AppThemeProvider");
  return ctx;
}
