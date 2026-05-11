'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useStorage, useFirestore } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import JSZip from 'jszip';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage 
} from '@/components/ui/form';
import { 
    Loader2, 
    UploadCloud, 
    FileText, 
    CheckCircle2, 
    Play, 
    X,
    Scan,
    FileArchive,
    FolderOpen,
    Info,
    RefreshCcw
} from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { generateGamePath } from '@/lib/game-sandbox';
import { AppLink } from '../ui/app-link';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Game } from '@/lib/types';
import { GamePlayer } from './game-player';

const uploadSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Please provide a more detailed description'),
  subject: z.string().min(1, 'Please select a subject'),
  gradeLevel: z.string().min(1, 'Please select a grade level'),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

const subjects = [
  "Mathematics", "English", "Setswana", "Science", 
  "Social Studies", "Creative Arts", "R.M.E"
];

const gradeLevels = [
  "Standard 1", "Standard 2", "Standard 3", "Standard 4", 
  "Standard 5", "Standard 6", "Standard 7"
];

function getMimeType(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html': return 'text/html';
    case 'js': return 'application/javascript';
    case 'css': return 'text/css';
    case 'json': return 'application/json';
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

interface GameUploaderProps {
    existingGame?: Game;
}

export function GameUploader({ existingGame }: GameUploaderProps) {
  const { user } = useUser();
  const storage = useStorage();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [files, setFiles] = React.useState<File[]>([]);
  const [manifest, setManifest] = React.useState<any>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = React.useState(false);
  
  const zipInputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: existingGame?.title || '',
      description: existingGame?.description || '',
      subject: existingGame?.subject || '',
      gradeLevel: existingGame?.gradeLevel || '',
    },
  });

  const watchedTitle = form.watch('title');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files ? Array.from(e.target.files) : [];
    if (selectedFiles.length === 0) return;

    const isZip = selectedFiles.length === 1 && selectedFiles[0].name.toLowerCase().endsWith('.zip');
    
    if (isZip) {
        const zip = new JSZip();
        try {
            const content = await zip.loadAsync(selectedFiles[0]);
            const extractedFiles: File[] = [];
            
            for (const [path, file] of Object.entries(content.files)) {
                if (file.dir) continue;
                const blob = await file.async('blob');
                const f = new File([blob], path, { type: getMimeType(path) });
                extractedFiles.push(f);
            }

            const manifestFile = extractedFiles.find(f => f.name.toLowerCase().endsWith('manifest.json'));
            if (manifestFile) {
                const text = await manifestFile.text();
                const parsedManifest = JSON.parse(text);
                setManifest(parsedManifest);
                form.setValue('title', parsedManifest.title || '');
                form.setValue('subject', parsedManifest.subject || '');
                form.setValue('gradeLevel', parsedManifest.gradeLevel || '');
            }
            setFiles(extractedFiles);
            toast({ title: "ZIP Extracted", description: `Loaded ${extractedFiles.length} files from archive.` });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error reading ZIP', description: 'Invalid or corrupt ZIP file.' });
        }
    } else {
        const manifestFile = selectedFiles.find(f => f.name === 'manifest.json');
        if (manifestFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsedManifest = JSON.parse(e.target?.result as string);
                    setManifest(parsedManifest);
                    form.setValue('title', parsedManifest.title || '');
                    form.setValue('subject', parsedManifest.subject || '');
                    form.setValue('gradeLevel', parsedManifest.gradeLevel || '');
                } catch (err) {
                    console.error("Failed to parse manifest", err);
                }
            };
            reader.readAsText(manifestFile);
        }
        setFiles(selectedFiles);
    }
  };

  const handlePreview = async () => {
    if (files.length === 0) {
        if (existingGame?.gameUrl) {
            setPreviewUrl(existingGame.gameUrl);
            return;
        }
        return;
    }
    
    const indexFile = files.find(f => f.name.toLowerCase() === 'index.html' || f.name.toLowerCase().endsWith('/index.html'));
    if (!indexFile) {
        toast({ variant: 'destructive', title: 'Missing index.html', description: 'Your game must have an index.html file.' });
        return;
    }

    try {
        const arrayBuffer = await indexFile.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        
        toast({
            title: "Student View Preview",
            description: "Launching game player... Note: assets might not load until final upload.",
        });
    } catch (err) {
        toast({ variant: 'destructive', title: 'Preview Failed', description: 'Could not generate local preview.' });
    }
  };

  const onSubmit = async (values: UploadFormValues) => {
    if (!storage || !firestore || !user) return;
    
    // In edit mode, if no new files, we just update metadata
    const isNewUpload = files.length > 0;

    setIsUploading(true);
    try {
        let finalGameUrl = existingGame?.gameUrl || '';
        let finalStoragePath = existingGame?.storagePath || '';

        if (isNewUpload) {
            const timestamp = Date.now();
            const baseFolder = generateGamePath(user.uid, timestamp);
            
            const indexFile = files.find(f => f.name.toLowerCase() === 'index.html' || f.name.toLowerCase().endsWith('/index.html'));
            if (!indexFile) throw new Error("Missing index.html file in upload.");

            const uploadPromises = files.map(async (file) => {
                const filePath = file.webkitRelativePath || file.name;
                const storageRef = ref(storage, baseFolder + filePath);
                return uploadBytes(storageRef, file, { contentType: file.type || getMimeType(file.name) });
            });

            await Promise.all(uploadPromises);

            const indexRef = ref(storage, baseFolder + (indexFile.webkitRelativePath || indexFile.name));
            finalGameUrl = await getDownloadURL(indexRef);
            finalStoragePath = indexRef.fullPath;
        }

        const gameData: any = {
          ...values,
          status: 'pending' as const,
          storagePath: finalStoragePath,
          gameUrl: finalGameUrl,
          manifest: manifest || existingGame?.manifest || {
              title: values.title,
              version: '1.0.0',
              subject: values.subject,
              gradeLevel: values.gradeLevel,
          },
          lastUpdatedAt: new Date().toISOString(),
        };

        if (existingGame) {
            const gameRef = doc(firestore, 'games', existingGame.id);
            updateDoc(gameRef, gameData)
                .then(() => {
                    setUploadComplete(true);
                    toast({ title: 'Update Successful!', description: 'Your game updates are now pending review.' });
                })
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: `games/${existingGame.id}`,
                        operation: 'update',
                        requestResourceData: gameData,
                    } satisfies SecurityRuleContext);
                    errorEmitter.emit('permission-error', permissionError);
                });
        } else {
            const createData = {
                ...gameData,
                developerId: user.uid,
                developerName: user.displayName || 'Anonymous Developer',
                playCount: 0,
                createdAt: new Date().toISOString(),
            };
            const gamesCollection = collection(firestore, 'games');
            addDoc(gamesCollection, createData)
                .then(() => {
                    setUploadComplete(true);
                    toast({ title: 'Submission Successful!', description: 'Your game is now pending review.' });
                })
                .catch(async (serverError) => {
                    const permissionError = new FirestorePermissionError({
                        path: 'games',
                        operation: 'create',
                        requestResourceData: createData,
                    } satisfies SecurityRuleContext);
                    errorEmitter.emit('permission-error', permissionError);
                });
        }

    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
    } finally {
        setIsUploading(false);
    }
  };

  if (uploadComplete) {
      return (
          <Card className="max-w-md mx-auto text-center py-10">
              <CardContent className="space-y-6">
                <div className="mx-auto bg-green-100 p-4 rounded-full w-fit">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">{existingGame ? 'Update Submitted!' : 'Game Submitted!'}</h2>
                    <p className="text-muted-foreground">
                        {existingGame 
                            ? 'Your changes have been saved and re-submitted for admin approval.'
                            : 'Your game was successfully uploaded and is now in the review queue.'}
                    </p>
                </div>
                <Button asChild className="w-full">
                    <AppLink href="/developer/dashboard">View My Dashboard</AppLink>
                </Button>
              </CardContent>
          </Card>
      );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-start text-left">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 lg:col-span-2">
                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-xl">{existingGame ? 'Edit Game' : 'Game Details'}</CardTitle>
                        <CardDescription>
                            {existingGame ? 'Updating metadata will reset approval status to pending.' : 'Basic information for the listing.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Game Title</FormLabel>
                                    <FormControl><Input placeholder="e.g., Math Quest 1" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Textarea placeholder="Explain the gameplay..." className="min-h-[80px]" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="subject"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subject</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="gradeLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Grade Level</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="py-4">
                        <CardTitle className="text-xl">Update Code</CardTitle>
                        <CardDescription>
                            {existingGame 
                                ? 'Upload a new ZIP or folder to replace the current version. Leave empty to keep existing code.' 
                                : 'Upload the game source files.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Button 
                                type="button"
                                variant="outline" 
                                className="h-24 flex flex-col gap-2 border-dashed"
                                onClick={() => zipInputRef.current?.click()}
                            >
                                <FileArchive className="h-6 w-6 text-muted-foreground" />
                                <span className="text-xs">Select ZIP File</span>
                            </Button>

                            <Button 
                                type="button"
                                variant="outline" 
                                className="h-24 flex flex-col gap-2 border-dashed"
                                onClick={() => folderInputRef.current?.click()}
                            >
                                <FolderOpen className="h-6 w-6 text-muted-foreground" />
                                <span className="text-xs">Select Folder</span>
                            </Button>
                        </div>
                        
                        <input type="file" ref={zipInputRef} accept=".zip" className="hidden" onChange={handleFileChange} />
                        <input type="file" ref={folderInputRef} className="hidden" onChange={handleFileChange} {...({ webkitdirectory: "", directory: "" } as any)} />

                        {files.length > 0 && (
                            <div className="bg-primary/5 p-2 rounded-md flex items-center justify-between border text-xs">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span className="font-medium truncate max-w-[200px]">
                                        {files.length} file(s) selected
                                    </span>
                                </div>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {setFiles([]); setManifest(null);}}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        {existingGame && files.length === 0 && (
                            <div className="bg-muted p-2 rounded-md flex items-center gap-2 text-[10px] text-muted-foreground">
                                <Info className="h-3 w-3" />
                                <span>Using current live version files.</span>
                            </div>
                        )}

                        {manifest && (
                            <Alert className="bg-blue-50 border-blue-200 py-2">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-xs font-bold">New Manifest Detected</AlertTitle>
                                <AlertDescription className="text-[10px]">
                                    Updated metadata automatically from manifest.json.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                <div className="flex gap-4">
                    <Button 
                        type="button" 
                        variant="outline" 
                        className="flex-1 h-11"
                        disabled={isUploading}
                        onClick={handlePreview}
                    >
                        <Play className="mr-2 h-4 w-4" /> Preview
                    </Button>
                    <Button 
                        type="submit" 
                        className="flex-1 h-11"
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                        {isUploading ? 'Uploading...' : (existingGame ? 'Save Updates' : 'Submit Game')}
                    </Button>
                </div>
            </form>
        </Form>

        <div className="space-y-4 sticky top-24 lg:col-span-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
                <Scan className="h-5 w-5 text-primary" /> Student View Preview
            </h3>
            <Card className="bg-black overflow-hidden relative group border-4 border-muted shadow-xl h-[400px] w-full">
                {previewUrl ? (
                    <div className="h-full w-full relative">
                        <GamePlayer 
                            gameId="preview"
                            gameUrl={previewUrl}
                            title={watchedTitle || "Game Preview"}
                        />
                        <div className="absolute top-12 right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Button size="sm" variant="destructive" className="h-7 text-[10px] font-black shadow-lg" onClick={() => {
                                 if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
                                 setPreviewUrl(null);
                             }}>STOP PREVIEW</Button>
                        </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                        <Play className="h-10 w-10 mb-3 opacity-20" />
                        <p className="text-sm font-medium">Ready to test?</p>
                        <p className="text-[10px] mt-2 italic opacity-70 px-4 leading-tight">
                            Select game files and click "Preview" to see exactly how students will see your game.
                        </p>
                    </div>
                )}
            </Card>
            <div className="p-4 bg-muted/30 rounded-xl border border-dashed space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Info className="h-3 w-3" /> Quick Tips
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                    <li>Updates will reset the status to <strong>Pending</strong>.</li>
                    <li>Ensure you update version numbers in your <code>manifest.json</code>.</li>
                    <li>The administrator will review the update before it goes live.</li>
                </ul>
            </div>
        </div>
    </div>
  );
}