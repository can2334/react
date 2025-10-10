// src/interfaces/auth.ts
export type User = {
    id: number;
    username: string;
    is_admin: boolean;
    profile_image?: string;
} | null;

export interface AuthContextType {
    user: User;
    login: (u: User) => void;
    logout: () => void;
    loading: boolean;
}
