export type UserRole = "student" | "lecturer";

export type User = {
  id: string;
  first_name?: string;
  last_name?: string;
  identifier?: string; // staff id / matric no
  role: UserRole;
  department?: string;
};

export type AuthResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  user?: User;
};
