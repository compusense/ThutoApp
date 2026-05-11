
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { UserProfile } from "@/firebase/auth/use-user"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getInitials = (name: string | null | undefined) => {
  if (!name) return "??";
  const names = name.split(" ");
  const initials = names.map((n) => n[0]).join("");
  return initials.length > 2 ? initials.substring(0, 2) : initials;
};

export const formatTeacherName = (teacher: UserProfile | null): string => {
    if (!teacher) {
        return "N/A";
    }

    // Prefer using detailed names if profile is complete
    if (teacher.firstName && teacher.surname) {
        const title = teacher.gender === 'Female' ? 'Ms.' : 'Mr.';
        // Create initials from all parts of the first name
        const initials = teacher.firstName
            .split(' ')
            .map(name => `${name.charAt(0).toUpperCase()}.`)
            .join('');
        return `${title} ${initials} ${teacher.surname}`;
    }

    // Fallback to displayName if details are not complete
    if (teacher.displayName) {
        return teacher.displayName;
    }

    // Final fallback
    return "N/A";
};

// Helper to format student name (e.g., "John F. Doe")
export function formatStudentName(firstName: string, surname: string): string {
    if (!firstName || !surname) return '';
    const names = firstName.split(' ');
    if (names.length > 1) {
        const first = names[0];
        const middles = names.slice(1).map(n => `${n.charAt(0).toUpperCase()}.`).join(' ');
        return `${first} ${middles} ${surname}`;
    }
    return `${firstName} ${surname}`;
}
