import { Router } from "express";
import {
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "../controllers/task.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { updateTaskSchema } from "../validators/task.validator.js";

const router = Router();

router.use(authenticate);

// project visibility and membership are enforced in the service layer;
// creating and listing one project's tasks live under /projects/:key/tasks
router.get("/", listTasks);
router.get("/:taskKey", getTask);
router.patch("/:taskKey", validate(updateTaskSchema), updateTask);
router.delete("/:taskKey", deleteTask);

export default router;
