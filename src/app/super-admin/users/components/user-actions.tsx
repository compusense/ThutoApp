
'use client';

import { useState } from 'react';
import { MoreHorizontal, Edit, Mail, Trash2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserProfile } from '@/firebase/auth/use-user';
import { School } from '../../schools/page';
import { EditUserDialog } from './edit-user-dialog';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { deactivateUser, sendPasswordReset } from '../actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SubRegion } from '../../sub-regions/page';
import { Region } from '../../regions/page';


interface UserActionsProps {
  user: UserProfile;
  schools: School[];
  regions: Region[];
  subRegions: SubRegion[];
}

export function UserActions({ user, schools, regions, subRegions }: UserActionsProps) {
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [isResetDialogOpen, setResetDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  
  const handlePasswordReset = async () => {
    if (!user.email) return;
    setIsProcessing(true);
    const result = await sendPasswordReset(user.email);
    if(result.success) {
        toast({ title: "Success", description: result.message });
    } else {
        toast({ variant: 'destructive', title: "Error", description: result.message });
    }
    setIsProcessing(false);
    setResetDialogOpen(false);
  }

  const handleDeactivation = async () => {
    setIsProcessing(true);
    const result = await deactivateUser(user.uid);
     if(result.success) {
        toast({ title: "Success", description: result.message });
        router.refresh();
    } else {
        toast({ variant: 'destructive', title: "Error", description: result.message });
    }
    setIsProcessing(false);
    setDeactivateDialogOpen(false);
  }

  return (
    <>
      <EditUserDialog
        isOpen={isEditDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={user}
        schools={schools}
        regions={regions}
        subRegions={subRegions}
      />
      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate {user.displayName}'s account and prevent them from logging in. This action can be reversed by an administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivation} disabled={isProcessing}>
                {isProcessing ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
       <AlertDialog open={isResetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Password Reset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a password reset link to {user.email}. The user will be required to set a new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordReset} disabled={isProcessing}>
                {isProcessing ? 'Sending...' : 'Send Email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={user.isDeactivated}>
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
            <Edit className="mr-2 h-4 w-4" />
            <span>Edit User</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            <span>Reset Password</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => setDeactivateDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Deactivate</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
