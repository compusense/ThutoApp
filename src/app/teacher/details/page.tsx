
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import { useFirestore, auth } from '@/firebase';
import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { School } from '@/app/super-admin/schools/page';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Camera, Loader2 } from 'lucide-react';
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from 'firebase/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { updateProfilePicture } from './actions';
import Cropper, { type Area } from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';


// --- Helper function for cropping ---
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<{ file: File, base64: string }> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );
  
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas is empty'));
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve({ file: new File([blob], "profile.jpg", { type: 'image/jpeg' }), base64: base64data });
      };
      reader.onerror = (error) => reject(error);
    }, 'image/jpeg');
  });
}


function DetailItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-4 items-start">
      <p className="md:col-span-1 text-sm font-semibold text-muted-foreground">{label}</p>
      <p className="md:col-span-2 text-base">{value}</p>
    </div>
  );
}

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;


function EditProfilePictureDialog() {
    const { user, loading } = useUser();
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);

    const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            let imageDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.addEventListener('load', () => resolve(reader.result as string));
                reader.readAsDataURL(file);
            });
            setImageSrc(imageDataUrl);
        }
    };
    
    const handleClose = () => {
        setIsOpen(false);
        setTimeout(() => {
            setImageSrc(null);
            setZoom(1);
            setCrop({ x: 0, y: 0 });
        }, 300); // delay reset to avoid flicker
    }


    const handleUpload = async () => {
        if (!imageSrc || !croppedAreaPixels || !user) return;
        
        setIsUploading(true);
        try {
            const { base64: croppedBase64, file: croppedFile } = await getCroppedImg(imageSrc, croppedAreaPixels);
            
            const idToken = await auth.currentUser?.getIdToken(true);
            if (!idToken) throw new Error("Authentication required.");

            const result = await updateProfilePicture({
                uid: user.uid,
                fileContent: croppedBase64,
                fileType: croppedFile.type,
            }, idToken);

            if (result.success) {
                toast({ title: "Success", description: "Your profile picture has been updated." });
                handleClose();
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
        } finally {
            setIsUploading(false);
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="h-6 w-6" />
                </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Change Profile Picture</DialogTitle>
                    <DialogDescription>Crop and adjust your new avatar.</DialogDescription>
                </DialogHeader>
                
                <div className="h-80 w-full relative bg-muted">
                    {imageSrc ? (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={1}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            cropShape="round"
                            showGrid={false}
                        />
                    ) : (
                         <div className="flex flex-col items-center justify-center h-full">
                           <label htmlFor="upload-photo" className="cursor-pointer text-center p-4">
                            <Camera className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Click to select an image</p>
                           </label>
                           <Input id="upload-photo" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </div>
                    )}
                </div>
                 {imageSrc && (
                    <div className="space-y-4">
                        <div>
                            <Label>Zoom</Label>
                            <Slider
                                value={[zoom]}
                                min={1}
                                max={3}
                                step={0.1}
                                onValueChange={(value) => setZoom(value[0])}
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setImageSrc(null)}>Choose a different image</Button>
                    </div>
                )}
                
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleUpload} disabled={isUploading || !imageSrc}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading ? 'Uploading...' : 'Save Picture'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function TeacherDetailsPage() {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [school, setSchool] = useState<School | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!firestore || !user?.schoolId) {
      setSchoolLoading(false);
      return;
    }

    const schoolRef = doc(firestore, 'schools', user.schoolId);
    const unsubscribe = onSnapshot(schoolRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchool({ id: docSnap.id, ...docSnap.data() } as School);
      } else {
        setSchool(null);
      }
      setSchoolLoading(false);
    }, (err: FirestoreError) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `schools/${user.schoolId}`, operation: 'get' }));
      setSchoolLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const onSubmit = async (values: PasswordFormValues) => {
    setIsSubmitting(true);
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Not logged in or email not found.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, values.newPassword);

      toast({
        title: 'Success',
        description: 'Your password has been changed successfully.',
      });
      form.reset();

    } catch (error: any) {
      console.error("Error changing password:", error);
      let errorMessage = 'An unexpected error occurred.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'The current password you entered is incorrect.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      toast({
        variant: 'destructive',
        title: 'Error Changing Password',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  const loading = userLoading || schoolLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between space-y-2">
            <div>
            <h2 className="text-2xl font-bold tracking-tight">My Details</h2>
            <p className="text-muted-foreground">Your personal and professional information.</p>
            </div>
        </div>
        <Card>
          <CardHeader className="flex flex-col items-center text-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <div>User not found.</div>;
  }
  
  const dob = user.dateOfBirth ? format(new Date(user.dateOfBirth), 'PPP') : 'N/A';

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between space-y-2">
            <div>
            <h2 className="text-2xl font-bold tracking-tight">My Details</h2>
            <p className="text-muted-foreground">
                Your personal and professional information as recorded in the system.
            </p>
            </div>
            {!user.detailsComplete && (
                <Button asChild>
                    <AppLink href="/teacher/complete-profile">Complete Your Profile</AppLink>
                </Button>
            )}
        </div>
        <Card>
            <CardHeader className="flex flex-col items-center text-center space-y-4">
                <div className="relative group/avatar">
                    <Avatar className="h-24 w-24 text-3xl">
                        <AvatarImage src={user.photoURL ?? undefined} alt={user.displayName ?? ''} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                    <EditProfilePictureDialog />
                </div>
                <div>
                    <CardTitle className="text-2xl">{user.displayName}</CardTitle>
                    <CardDescription>{user.email}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 border-t pt-6">
                <DetailItem label="First Name(s)" value={user.firstName} />
                <DetailItem label="Surname" value={user.surname} />
                <DetailItem label="National ID" value={user.idNumber} />
                <DetailItem label="Date of Birth" value={dob} />
                <DetailItem label="Gender" value={user.gender} />
                <DetailItem label="Nationality" value={user.nationality} />
                <DetailItem label="Role" value={user.role?.replace('-', ' ')} />
                <DetailItem label="Assigned School" value={school?.name} />
                <DetailItem label="School REG.NO" value={school?.regNo} />
                <DetailItem label="Nature of Employment" value={user.natureOfEmployment} />
                <DetailItem label="Post" value={user.post} />
                <DetailItem label="Portfolio" value={user.portfolio} />
                <DetailItem label="Salary Scale" value={user.salaryScale} />
                <DetailItem label="Qualification" value={user.qualification} />
                <DetailItem label="Qualification Details" value={user.qualificationDetails} />
            </CardContent>
        </Card>
        
        <Accordion type="single" collapsible className="w-full">
            <Card>
                <AccordionItem value="item-1" className="border-b-0">
                    <AccordionTrigger className="p-6 hover:no-underline">
                        <div className="text-left">
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription className="mt-1.5">
                                Click to expand and change your password.
                            </CardDescription>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
                            <FormField
                                control={form.control}
                                name="currentPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Current Password</FormLabel>
                                    <FormControl>
                                    <PasswordInput {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="newPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                    <PasswordInput {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm New Password</FormLabel>
                                    <FormControl>
                                    <PasswordInput {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Change Password
                            </Button>
                            </form>
                        </Form>
                    </AccordionContent>
                </AccordionItem>
            </Card>
      </Accordion>

    </div>
  );
}
