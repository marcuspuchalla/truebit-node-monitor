export interface TaskArtifact {
  id?: number;
  execution_id: string;
  artifact_type: string;
  hash: string | null;
  path: string | null;
  size_bytes: number | null;
  created_at?: string;
}
