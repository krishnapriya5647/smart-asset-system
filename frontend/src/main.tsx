import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { createTheme } from "@mui/material/styles";

import { router } from "./router";
import { themeStore, type ThemeMode } from "./theme/themeStore";

const queryClient = new QueryClient();

function buildTheme(mode: ThemeMode) {
  return createTheme({
    palette: {
      mode,
      ...(mode === "dark"
        ? { background: { default: "#0B0D10", paper: "#111315" } }
        : { background: { default: "#f6f7fb", paper: "#ffffff" } }),
    },
    shape: { borderRadius: 12 },
typography: {
  fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 600,
},    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
      MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
      ...(mode === "dark"
        ? {
            MuiCard: {
              styleOverrides: {
                root: {
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                },
              },
            },
          }
        : {
            MuiCard: {
              styleOverrides: {
                root: {
                  border: "1px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                },
              },
            },
          }),
    },
  });
}

// Export it so react-refresh/only-export-components is satisfied
export function Root() {
  const [mode, setMode] = React.useState<ThemeMode>(() => themeStore.get());

  React.useEffect(() => {
    const onChange = () => setMode(themeStore.get());
    window.addEventListener("theme_mode_changed", onChange);
    return () => window.removeEventListener("theme_mode_changed", onChange);
  }, []);

  const theme = React.useMemo(() => buildTheme(mode), [mode]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
