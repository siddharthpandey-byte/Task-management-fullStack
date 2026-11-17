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
import { authenticate, authorize } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../validators/project.validator.js";

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

export default router;
