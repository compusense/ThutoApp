'use client';

import * as React from 'react';
import { useFirestore, auth } from '@/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    Loader2, 
    Gamepad2,
    Eye,
    MessageSquare,
    AlertCircle,
    FileText
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Game } from '@/lib/types';
import { format } from 'date-fns';
import { reviewGame } from './actions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { GamePlayer } from '@/components/sandbox/game-player';

export default function GameReviewDashboard() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [games, setGames] = React.useState<Game[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    
    // Review Modal State
    const [selectedGame, setSelectedGame] = React.useState<Game | null>(null);
    const [reviewComment, setReviewComment] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    React.useEffect(() => {
        if (!firestore) return;

        const q = query(collection(firestore, 'games'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
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
    }, [firestore]);

    const handleReview = async (status: 'approved' | 'rejected') => {
        if (!selectedGame) return;
        
        setIsSubmitting(true);
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error("Auth required");

            const result = await reviewGame({
                gameId: selectedGame.id,
                status,
                reviewComment,
            }, idToken);

            if (result.success) {
                toast({ title: "Success", description: result.message });
                setSelectedGame(null);
                setReviewComment('');
            } else {
                throw new Error(result.message);
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: "Error", description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredGames = React.useMemo(() => {
        return games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));
    }, [games, search]);

    const renderTable = (status: string) => {
        const list = filteredGames.filter(g => g.status === status);
        
        if (list.length === 0) {
            return (
                <div className="py-20 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                    <p>No {status} games found.</p>
                </div>
            );
        }

        return (
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Game Title</TableHead>
                            <TableHead>Developer</TableHead>
                            <TableHead>Subject / Grade</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((game) => (
                            <TableRow key={game.id}>
                                <TableCell className="font-bold">{game.title}</TableCell>
                                <TableCell>{game.developerName}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        <Badge variant="secondary" className="w-fit text-[10px]">{game.subject}</Badge>
                                        <span className="text-xs text-muted-foreground">{game.gradeLevel}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                    {format(new Date(game.createdAt), 'PP p')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" variant="outline" onClick={() => setSelectedGame(game)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        {status === 'pending' ? 'Review' : 'View'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Game Review Board</h2>
                    <p className="text-muted-foreground">Manage and approve educational content for the student sandbox.</p>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search games..." 
                        className="pl-8" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                    <TabsTrigger value="pending" className="flex gap-2">
                        <Clock className="h-4 w-4" /> Pending
                    </TabsTrigger>
                    <TabsTrigger value="approved" className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Approved
                    </TabsTrigger>
                    <TabsTrigger value="rejected" className="flex gap-2">
                        <XCircle className="h-4 w-4" /> Rejected
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="pending" className="mt-6 space-y-4">
                    {renderTable('pending')}
                </TabsContent>

                <TabsContent value="approved" className="mt-6 space-y-4">
                    {renderTable('approved')}
                </TabsContent>

                <TabsContent value="rejected" className="mt-6 space-y-4">
                    {renderTable('rejected')}
                </TabsContent>
            </Tabs>

            {/* Review Dialog */}
            <Dialog open={!!selectedGame} onOpenChange={(open) => !open && setSelectedGame(null)}>
                <DialogContent className="max-w-6xl max-h-[85vh] h-full flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                    <div className="p-3 border-b bg-background shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-lg">Review: {selectedGame?.title}</DialogTitle>
                            <DialogDescription className="text-[10px]">
                                Submitted by {selectedGame?.developerName} for {selectedGame?.subject} ({selectedGame?.gradeLevel})
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden min-h-0">
                        <div className="lg:col-span-2 overflow-hidden flex flex-col bg-black relative">
                            {selectedGame && (
                                <GamePlayer 
                                  gameId={selectedGame.id}
                                  gameUrl={selectedGame.gameUrl}
                                  title={selectedGame.title}
                                />
                            )}
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto bg-muted/5 border-l">
                            <Card className="shadow-none border-dashed bg-transparent">
                                <CardHeader className="p-3">
                                    <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                                        <FileText className="h-3 w-3" /> Developer Notes
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-0">
                                    <p className="text-[10px] leading-tight text-muted-foreground whitespace-pre-wrap">
                                        {selectedGame?.description}
                                    </p>
                                </CardContent>
                            </Card>

                            <div className="space-y-1">
                                <Label htmlFor="review-comment" className="flex items-center gap-2 font-black text-[9px] uppercase tracking-wider text-muted-foreground">
                                    <MessageSquare className="h-3 w-3" /> 
                                    Decision Feedback
                                </Label>
                                <Textarea 
                                    id="review-comment"
                                    placeholder="Explain your decision to the developer..."
                                    className="min-h-[100px] text-xs bg-background resize-none"
                                    value={reviewComment}
                                    onChange={(e) => setReviewComment(e.target.value)}
                                    disabled={selectedGame?.status !== 'pending'}
                                />
                            </div>

                            {selectedGame?.status === 'pending' ? (
                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <Button 
                                        variant="destructive" 
                                        className="w-full h-9 text-xs font-bold"
                                        disabled={isSubmitting}
                                        onClick={() => handleReview('rejected')}
                                    >
                                        <XCircle className="mr-1 h-3 w-3" /> Reject
                                    </Button>
                                    <Button 
                                        className="w-full h-9 text-xs font-bold"
                                        disabled={isSubmitting}
                                        onClick={() => handleReview('approved')}
                                    >
                                        <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                                    </Button>
                                </div>
                            ) : (
                                <Alert className="bg-muted/50 border-none py-2 px-3">
                                    <AlertCircle className="h-3 w-3" />
                                    <AlertTitle className="text-[9px] font-black uppercase">Review Log</AlertTitle>
                                    <AlertDescription className="text-[9px]">
                                        Decision reached on {selectedGame?.reviewedAt ? format(new Date(selectedGame.reviewedAt), 'PP') : 'N/A'}.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-2 border-t bg-background flex justify-end shrink-0">
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedGame(null)}>Close Review</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
