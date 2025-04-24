export interface User {
  id: string;
  name: string;
  email: string;
  default_currency: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  default_currency: string;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  default_currency?: string;
} 