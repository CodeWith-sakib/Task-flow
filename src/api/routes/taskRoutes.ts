import { Router } from 'express';
import { TaskController } from '../controllers/TaskController';

export function createTaskRoutes(controller: TaskController): Router {
  const router = Router();

  router.post('/tasks', (req, res) => controller.createTask(req, res));
  router.get('/tasks/:id', (req, res) => controller.getTask(req, res));
  router.get('/tasks', (req, res) => {
    if (req.query.status) {
      controller.getTasksByStatus(req, res);
    } else {
      controller.getAllTasks(req, res);
    }
  });
  router.post('/tasks/:id/enqueue', (req, res) => controller.enqueueTask(req, res));

  return router;
}
