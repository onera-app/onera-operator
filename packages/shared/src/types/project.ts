export interface Project {
  id: string;
  name: string;
  description: string | null;
  product: string | null;
  targetUsers: string | null;
  competitors: string | null;
  goals: string | null;
  website: string | null;
  paused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  product?: string;
  targetUsers?: string;
  competitors?: string;
  goals?: string;
  website?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {}

export interface ProjectContext {
  name: string;
  description: string;
  product: string;
  targetUsers: string;
  competitors: string[];
  goals: string[];
  website: string;
}
