import { lazy } from "react";

// Each page is its own chunk, loaded on first visit
export const LoginPage = lazy(() => import("../pages/Login"));
export const SignupPage = lazy(() => import("../pages/Signup"));
export const ForgotPasswordPage = lazy(() => import("../pages/ForgotPassword"));
export const ResetPasswordPage = lazy(() => import("../pages/ResetPassword"));
export const DashboardPage = lazy(() => import("../pages/Dashboard"));
export const ProjectsPage = lazy(() => import("../pages/Projects"));
export const ProjectSettingsPage = lazy(() => import("../pages/ProjectSettings"));
export const ProjectTasksPage = lazy(() => import("../pages/ProjectTasks"));
export const ProjectBoardPage = lazy(() => import("../pages/ProjectBoard"));
export const BoardHomePage = lazy(() => import("../pages/BoardHome"));
export const TasksPage = lazy(() => import("../pages/Tasks"));
export const TaskDetailPage = lazy(() => import("../pages/TaskDetail"));
export const AdminPage = lazy(() => import("../pages/Admin"));
export const NotFoundPage = lazy(() => import("../pages/NotFound"));
