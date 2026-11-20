import { Router } from "express";
import { ROLES } from "../constants.js";
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  restoreProject,
  updateProject,
} from "../controllers/project.controller.js";
import {
  createTask,
  getBoard,
  listProjectTasks,
} from "../controllers/task.controller.js";
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../validators/project.validator.js";
import { createTaskSchema } from "../validators/task.validator.js";

const router = Router();
const canWrite = authorize(ROLES.ADMIN, ROLES.MANAGER);

router.use(authenticate);

// visibility and lead-ownership are enforced in the service layer
router.get("/", listProjects);
router.post("/", canWrite, validate(createProjectSchema), createProject);
router.get("/:key", getProject);
router.patch("/:key", canWrite, validate(updateProjectSchema), updateProject);
router.post("/:key/archive", canWrite, archiveProject);
router.post("/:key/restore", canWrite, restoreProject);

// any project member can create tasks (checked in the task service)
router.get("/:key/tasks", listProjectTasks);
router.post("/:key/tasks", validate(createTaskSchema), createTask);
router.get("/:key/board", getBoard);

export default router;
