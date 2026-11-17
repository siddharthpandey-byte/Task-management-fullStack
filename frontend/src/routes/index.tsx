import { createBrowserRouter, Navigate } from "react-router";
import { ROLES } from "../constants/auth.constant";
import { ROUTES } from "../constants/route.constant";
import AppLayout from "../layouts/AppLayout";
import AuthLayout from "../layouts/AuthLayout";
import RootLayout from "../layouts/RootLayout";
import RouteErrorPage from "../pages/RouteError";
import { GuestRoute } from "./guards/GuestRoute";
import { ProtectedRoute } from "./guards/ProtectedRoute";
import { RoleRoute } from "./guards/RoleRoute";
import {
  AdminPage,
  DashboardPage,
  ForgotPasswordPage,
  LoginPage,
  NotFoundPage,
  ProjectSettingsPage,
  ProjectsPage,
  ProjectTasksPage,
  ResetPasswordPage,
  SignupPage,
  TaskDetailPage,
  TasksPage,
} from "./lazy.pages";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: ROUTES.HOME, element: <Navigate to={ROUTES.DASHBOARD} replace /> },

      // signed-out only
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              { path: ROUTES.LOGIN, element: <LoginPage /> },
              { path: ROUTES.SIGNUP, element: <SignupPage /> },
            ],
          },
        ],
      },

      // reachable whether or not signed in (reset links are opened from email)
      {
        element: <AuthLayout />,
        children: [
          { path: ROUTES.FORGOT_PASSWORD, element: <ForgotPasswordPage /> },
          { path: ROUTES.RESET_PASSWORD, element: <ResetPasswordPage /> },
        ],
      },

      // signed-in only
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
              { path: ROUTES.PROJECTS, element: <ProjectsPage /> },
              // visibility is enforced by the API (404 for projects you can't see)
              { path: ROUTES.PROJECT_SETTINGS, element: <ProjectSettingsPage /> },
              { path: ROUTES.PROJECT_TASKS, element: <ProjectTasksPage /> },
              { path: ROUTES.TASKS, element: <TasksPage /> },
              { path: ROUTES.TASK_DETAIL, element: <TaskDetailPage /> },
              {
                element: <RoleRoute allow={[ROLES.ADMIN]} />,
                children: [{ path: ROUTES.ADMIN, element: <AdminPage /> }],
              },
            ],
          },
        ],
      },

      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
