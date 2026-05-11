'use client';

import * as React from 'react';
import { useFirestore, useUser, auth } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardHeader, 
    CardTitle 
} from '@/components/ui/card';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { 
    Loader2, 
    Gamepad2, 
    PlusCircle, 
    Clock, 
    CheckCircle2, 
    XCircle,
    ScanEye,
    Pencil,
    Download
} from 'lucide-react';
import { Game } from '@/lib/types';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger 
} from '@/components/ui/dialog';
import { GamePlayer } from '@/components/sandbox/game-player';
import { downloadGameSource } from '../actions';
import { saveAs } from 'file-saver';
import { useToast } from '@/hooks/use-toast';

export default function DeveloperDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [games, setGames] = React.useState<Game[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activePreview, setActivePreview] = React.useState<Game | null>(null);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!firestore || !user?.uid) return;

    const q = query(
        collection(firestore, 'games'), 
        where('developerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
        fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setGames(fetched);
        setLoading(false);
    }, async (err) => {
        const permissionError = new FirestorePermissionError({
            path: 'games',
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firestore, user]);

  const handleDownload = async (game: Game) => {
    setIsDownloading(game.id);
    try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Auth required");

        const result = await downloadGameSource(game.id, idToken);

        if (result.success && result.data) {
            const blob = new Blob([Buffer.from(result.data, 'base64')], { type: 'application/zip' });
            saveAs(blob, result.fileName || 'game_source.zip');
            toast({ title: "Download Complete", description: "Your game source code has been downloaded." });
        } else {
            throw new Error(result.message);
        }
    } catch (err: any) {
        toast({ variant: 'destructive', title: "Download Failed", description: err.message });
    } finally {
        setIsDownloading(null);
    }
  };

  const stats = React.useMemo(() => {
    return {
        total: games.length,
        approved: games.filter(g => g.status === 'approved').length,
        pending: games.filter(g => g.status === 'pending').length,
        plays: games.reduce((acc, g) => acc + (g.playCount || 0), 0),
    };
  }, [games]);

  if (loading) {
      return <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="text-left">
          <h1 className="text-3xl font-bold tracking-tight">Developer Dashboard</h1>
          <p className="text-muted-foreground">Manage your educational games and track their performance.</p>
        </div>
        <Button asChild>
          <AppLink href="/developer/games/upload">
            <PlusCircle className="mr-2 h-4 w-4" />
            Upload New Game
          </AppLink>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="text-left">
            <CardHeader className="pb-2">
                <CardDescription>Total Uploads</CardDescription>
                <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
        </Card>
        <Card className="text-left">
            <CardHeader className="pb-2">
                <CardDescription>Approved Games</CardDescription>
                <CardTitle className="text-2xl text-green-600">{stats.approved}</CardTitle>
            </CardHeader>
        </Card>
        <Card className="text-left">
            <CardHeader className="pb-2">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-2xl text-amber-600">{stats.pending}</CardTitle>
            </CardHeader>
        </Card>
        <Card className="text-left">
            <CardHeader className="pb-2">
                <CardDescription>Total Plays</CardDescription>
                <CardTitle className="text-2xl text-blue-600">{stats.plays}</CardTitle>
            </CardHeader>
        </Card>
      </div>

      <Card className="text-left">
        <CardHeader>
          <CardTitle>My Submissions</CardTitle>
          <CardDescription>Current status of your game uploads.</CardDescription>
        </CardHeader>
        <CardContent>
          {games.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
                <Gamepad2 className="mx-auto h-12 w-12 opacity-20 mb-4" />
                <p>You haven't uploaded any games yet.</p>
                <Button variant="link" asChild>
                    <AppLink href="/developer/games/upload">Get started by uploading your first game</AppLink>
                </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Game Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plays</TableHead>
                    <TableHead>Date Uploaded</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {games.map((game) => (
                    <TableRow key={game.id}>
                      <TableCell className="font-medium">{game.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{game.subject}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                            {game.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                            {game.status === 'approved' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            {game.status === 'rejected' && <XCircle className="h-4 w-4 text-destructive" />}
                            <span className="capitalize">{game.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>{game.playCount || 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(game.createdAt), 'PPP')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleDownload(game)}
                                disabled={isDownloading === game.id}
                            >
                                {isDownloading === game.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-1 h-3.5 w-3.5" />
                                )}
                                Download
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <AppLink href={`/developer/games/${game.id}/edit`}>
                                    <Pencil className="mr-1 h-3.5 w-3.5" />
                                    Update
                                </AppLink>
                            </Button>
                            <Dialog onOpenChange={(open) => !open && setActivePreview(null)}>
                                <DialogTrigger asChild>
                                    <Button variant="secondary" size="sm" onClick={() => setActivePreview(game)}>
                                        <ScanEye className="mr-1.5 h-4 w-4" />
                                        Student View
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-6xl p-0 overflow-hidden bg-black border-none h-[85vh]">
                                    <DialogHeader className="sr-only">
                                        <DialogTitle>Testing: {game.title}</DialogTitle>
                                        <DialogDescription>Previewing game as it appears to students.</DialogDescription>
                                    </DialogHeader>
                                    {activePreview?.id === game.id && (
                                        <GamePlayer 
                                            gameId={activePreview.id}
                                            gameUrl={activePreview.gameUrl}
                                            title={activePreview.title}
                                        />
                                    )}
                                </DialogContent>
                            </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
