import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Dashboard from "./pages/Dashboard";
import Assets from "./pages/Assets";
import AssetDetails from "./pages/AssetDetails";
import Inventory from "./pages/Inventory";
import Assignments from "./pages/Assignments";
import AssignmentDetails from "./pages/AssignmentDetails";
import Tickets from "./pages/Tickets";
import TicketDetails from "./pages/TicketDetails";
import Profile from "./pages/Profile";
import EmployeeDetails from "./pages/EmployeeDetails";
import Login from "./pages/Login";

import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

export const router = createBrowserRouter([

  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Dashboard /> },

      { path: "assets", element: <Assets /> },
      { path: "assets/:id", element: <AssetDetails /> },

      { path: "inventory", element: <Inventory /> },

      { path: "assignments", element: <Assignments /> },
      { path: "assignments/:id", element: <AssignmentDetails /> },

      { path: "tickets", element: <Tickets /> },
      { path: "tickets/:id", element: <TicketDetails /> },

      { path: "profile", element: <Profile /> },

      // Admin employee profile page
      { path: "employees/:id", element: <EmployeeDetails /> },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/reset-password/:uid/:token", element: <ResetPassword /> },
]);
