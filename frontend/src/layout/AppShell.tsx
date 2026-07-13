import { ReactNode } from "react";
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import WorkOutlineIcon from "@mui/icons-material/WorkOutline";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import LogoutIcon from "@mui/icons-material/Logout";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useThemeMode } from "../theme/ThemeProvider";
import { EPIROC_BLACK, EPIROC_YELLOW } from "../theme/epirocBrand";

const DRAWER_WIDTH = 220;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: EPIROC_BLACK,
          borderBottom: "3px solid",
          borderColor: EPIROC_YELLOW,
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <WorkOutlineIcon sx={{ color: EPIROC_YELLOW }} />
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 700, color: "#FFFFFF" }}>
            Job Lifecycle Management
          </Typography>
          <Tooltip title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}>
            <IconButton onClick={toggleMode} sx={{ color: "#FFFFFF" }}>
              {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>
          {user && (
            <>
              <Tooltip title={`${user.name} (${user.role})`}>
                <Avatar sx={{ width: 32, height: 32, ml: 1, bgcolor: EPIROC_YELLOW, color: EPIROC_BLACK, fontSize: 14, fontWeight: 700 }}>
                  {user.name.slice(0, 1)}
                </Avatar>
              </Tooltip>
              <Tooltip title="Log out">
                <IconButton
                  sx={{ color: "#FFFFFF" }}
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List sx={{ px: 1, pt: 1 }}>
          {user?.role !== "STOREMAN" && (
            <ListItemButton
              component={NavLink}
              to="/dashboard"
              sx={{
                borderRadius: 1,
                borderLeft: "3px solid transparent",
                "&.active": { bgcolor: "action.selected", borderColor: EPIROC_YELLOW },
              }}
            >
              <ListItemIcon>
                <DashboardIcon />
              </ListItemIcon>
              <ListItemText primary="Dashboard" />
            </ListItemButton>
          )}
          <ListItemButton
            component={NavLink}
            to="/jobs"
            sx={{
              borderRadius: 1,
              borderLeft: "3px solid transparent",
              "&.active": { bgcolor: "action.selected", borderColor: EPIROC_YELLOW },
            }}
          >
            <ListItemIcon>
              <WorkOutlineIcon />
            </ListItemIcon>
            <ListItemText primary="Jobs" />
          </ListItemButton>
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: "background.default", minHeight: "100vh" }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
