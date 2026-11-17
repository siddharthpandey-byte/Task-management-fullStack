import { lazy } from "react";

// Each page is its own chunk, loaded on first visit
export const LoginPage = lazy(() => import("../pages/Login"));
export const SignupPage = lazy(() => import("../pages/Signup"));
export const ForgotPasswordPage = lazy(() => import("../pages/ForgotPassword"));
export const ResetPasswordPage = lazy(() => import("../pages/ResetPassword"));
export const DashboardPage = lazy(() => import("../pages/Dashboard"));
export const ProjectsPage = lazy(() => import("../pages/Projects"));
export const ProjectSettingsPage = lazy(() => import("../pages/ProjectSettings"));
export const AdminPage = lazy(() => import("../pages/Admin"));
export const NotFoundPage = lazy(() => import("../pages/NotFound"));
