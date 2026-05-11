
export type UserRole = "super-admin" | "school-head" | "teacher" | "sub-region-admin" | "student" | "developer";

export type User = {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
};

export interface GameManifest {
  title: string;
  version: string;
  subject: string;
  gradeLevel: string;
  minScoreToPass?: number;
}

export interface Game {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  developerId: string;
  developerName: string;
  status: 'pending' | 'approved' | 'rejected';
  storagePath: string;           // path to index.html in Firebase Storage
  gameUrl: string;               // full public URL
  thumbnailUrl?: string;
  manifest: GameManifest;
  playCount: number;
  createdAt: string;             // ISO string
  reviewedAt?: string;           // ISO string
  reviewedBy?: string;
}

export interface GameActivity {
  id: string;
  gameId: string;
  studentId: string;
  score: number;
  timeSpent: number; // in seconds
  completedAt: string; // ISO string
}
