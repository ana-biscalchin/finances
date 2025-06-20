import { Router } from 'express';
import { UserService } from '../domains/users/service';
import { CreateUserDTO, UpdateUserDTO } from '../domains/users/types';
import { validateCreateUser, validateUpdateUser } from '../middlewares/validators/user-validator';

const router = Router();
const userService = new UserService();

// Create user
router.post('/', validateCreateUser, async (req, res, next) => {
  try {
    const userData: CreateUserDTO = req.body;
    const user = await userService.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
});

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Get user by email  
router.get('/email/:email', async (req, res, next) => {
  try {
    const user = await userService.getUserByEmail(req.params.email);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Update user
router.put('/:id', validateUpdateUser, async (req, res, next) => {
  try {
    const userData: UpdateUserDTO = req.body;
    const user = await userService.updateUser(req.params.id, userData);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Delete user
router.delete('/:id', async (req, res, next) => {
  try {
    const success = await userService.deleteUser(req.params.id);
    if (!success) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router; 