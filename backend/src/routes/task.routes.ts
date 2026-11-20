import { Router } from "express";
import {
  deleteTask,
  getTask,
  listTasks,
  moveTask,
  updateTask,
} from "../controllers/task.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  moveTaskSchema,
  updateTaskSchema,
} from "../validators/task.validator.js";

const router = Router();

router.use(authenticate);

// project visibility and membership are enforced in the service layer;
// creating and listing one project's tasks live under /projects/:key/tasks
router.get("/", listTasks);
router.get("/:taskKey", getTask);
router.patch("/:taskKey", validate(updateTaskSchema), updateTask);
router.delete("/:taskKey", deleteTask);
// drag-and-drop on the board: status + position in one atomic change
router.post("/:taskKey/move", validate(moveTaskSchema), moveTask);

export default router;
