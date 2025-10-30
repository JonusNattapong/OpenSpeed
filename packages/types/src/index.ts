import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Post schemas
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().optional(),
  published: z.boolean().default(false),
});

export const postSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().nullable(),
  published: z.boolean(),
  authorId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// API response schemas
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional(),
});

export const successResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
});

// Types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type User = z.infer<typeof userSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type Post = z.infer<typeof postSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;