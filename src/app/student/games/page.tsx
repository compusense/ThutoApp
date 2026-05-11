'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { auth, useFirestore } from '@/firebase';
import { 
    Gamepad2, 
    Search, 
    Trophy, 
    Loader2, 
    Filter,
    Play,
    Star,
    Swords
} from 'lucide-react';
import { 
    Card, 
    CardContent, 
    CardDescription, 
    CardFooter, 
    CardHeader, 
    CardTitle 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GamePlayer } from '@/components/sandbox/game-player';
import { fetchApprovedGames, fetchStudentActivity } from './actions';
import { Game } from '@/lib/types';
import { AppLink } from '@/components/ui/app-link';
import { cn } from '@/lib/utils';

const subjects = ["All Subjects", "Mathematics", "English", "Science", "Social Studies", "Setswana"];
const gradeLevels = ["All Grades", "Standard 1", "Standard 2", "Standard 3", "Standard 4", "Standard 5", "Standard 6", "Standard 7"];

export default function StudentGameCenterPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [loading, setLoading] = React.useState(true);
    const [games, setGames] = React.useState<Game[]>([]);
    const [highScores, setHighScores] = React.useState<Record<string, number>>({});
    
    const [search, setSearch] = React.useState('');
    const [subject, setSubject] = React.useState('All Subjects');
    const [grade, setGrade] = React.useState('All Grades');
    const [sortBy, setSortBy] = React.useState('newest');

    const [activeGame, setActiveGame] = React.useState<Game | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) return;

            const [gamesRes, activityRes] = await Promise.all([
                fetchApprovedGames(idToken),
                fetchStudentActivity(idToken)
            ]);

            if (gamesRes.success) setGames(gamesRes.data || []);
            if (activityRes.success) setHighScores(activityRes.data || {});
            
            setLoading(false);
        };
        loadData();
    }, []);

    const filteredGames = React.useMemo(() => {
        return games.filter(game => {
            const matchesSearch = game.title.toLowerCase().includes(search.toLowerCase());
            const matchesSubject = subject === 'All Subjects' || game.subject === subject;
            const matchesGrade = grade === 'All Grades' || game.gradeLevel === grade;
            return matchesSearch && matchesSubject && matchesGrade;
        }).sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (sortBy === 'popular') return (b.playCount || 0) - (a.playCount || 0);
            return 0;
        });
    }, [games, search, subject, grade, sortBy]);

    if (loading) {
        return <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary/10 via-background to-secondary/10 p-6 rounded-2xl border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-primary p-2 rounded-xl text-white shadow-md">
                        <Gamepad2 className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-primary uppercase">Game Center</h1>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Level Up Your Learning</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-xl border shadow-sm">
                    <Trophy className="h-5 w-5 text-accent" />
                    <div className="text-left">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground leading-none">Global Points</p>
                        <p className="text-lg font-black leading-none mt-1">{user?.tugOfWarScore || 0}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {/* Featured Real-Time Game */}
                <Card className="overflow-hidden rounded-[2rem] border-4 border-primary/20 shadow-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 text-white relative group">
                    <div className="absolute right-0 top-0 opacity-10 -rotate-12 translate-x-1/4 -translate-y-1/4 transition-transform group-hover:rotate-0 duration-700">
                        <Swords size={200} />
                    </div>
                    <CardContent className="p-6 md:p-8 relative z-10 flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-1 space-y-2 text-center md:text-left">
                            <Badge className="bg-yellow-400 text-black border-none font-black px-3 py-0.5 text-[10px] uppercase tracking-widest mb-2">Live Battle</Badge>
                            <h2 className="text-3xl md:text-4xl font-black tracking-tighter italic leading-tight">MATH TUG-OF-WAR</h2>
                            <p className="text-xs md:text-sm font-medium opacity-90 leading-relaxed max-w-md">
                                Battle your classmates in a real-time test of speed and accuracy! Climb the leaderboard and earn Global Points.
                            </p>
                            <Button asChild size="lg" className="h-12 px-8 text-sm font-black bg-white text-primary hover:bg-white/90 hover:scale-105 transition-all rounded-2xl shadow-xl mt-4">
                                <AppLink href="/student/games/tug-of-war">BATTLE NOW!</AppLink>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Filters Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/20 rounded-[1.5rem] border border-dashed">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search library..." 
                            className="pl-9 h-11 bg-background rounded-xl border-none shadow-sm text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="h-11 bg-background rounded-xl border-none shadow-sm text-sm">
                            <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Subject" />
                        </SelectTrigger>
                        <SelectContent>
                            {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={grade} onValueChange={setGrade}>
                        <SelectTrigger className="h-11 bg-background rounded-xl border-none shadow-sm text-sm">
                            <Star className="mr-2 h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Grade" />
                        </SelectTrigger>
                        <SelectContent>
                            {gradeLevels.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="h-11 bg-background rounded-xl border-none shadow-sm text-sm font-bold">
                            <SelectValue placeholder="Sort" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="newest">Newest</SelectItem>
                            <SelectItem value="popular">Popular</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Games Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredGames.map((game) => (
                        <Card key={game.id} className="group overflow-hidden rounded-[2rem] transition-all hover:shadow-2xl border-2 border-transparent hover:border-primary/20 flex flex-col h-full bg-card">
                            <div className="relative aspect-video bg-muted overflow-hidden">
                                <img 
                                    src={game.thumbnailUrl || `https://picsum.photos/seed/${game.id}/400/225`} 
                                    alt={game.title}
                                    className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                        <Dialog onOpenChange={(open) => !open && setActiveGame(null)}>
                                        <DialogTrigger asChild>
                                            <Button size="icon" className="rounded-full h-14 w-14 shadow-2xl scale-90 group-hover:scale-100 transition-transform" onClick={() => setActiveGame(game)}>
                                                <Play className="fill-current h-6 w-6 ml-1" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-6xl p-0 overflow-hidden bg-black border-none h-[85vh]">
                                            <DialogHeader className="sr-only">
                                                <DialogTitle>Playing {game.title}</DialogTitle>
                                                <DialogDescription>Educational game for {game.subject}</DialogDescription>
                                            </DialogHeader>
                                            {activeGame?.id === game.id && (
                                                <GamePlayer 
                                                    gameId={activeGame.id}
                                                    gameUrl={activeGame.gameUrl}
                                                    title={activeGame.title}
                                                />
                                            )}
                                        </DialogContent>
                                    </Dialog>
                                </div>
                                <Badge className="absolute top-3 left-3 bg-white/90 text-primary hover:bg-white backdrop-blur-sm border-none shadow-sm text-[10px] font-black px-2 py-0.5 rounded-lg uppercase">{game.subject}</Badge>
                            </div>
                            <CardHeader className="p-5 flex-grow space-y-1">
                                <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">{game.gradeLevel}</p>
                                <CardTitle className="text-lg font-bold line-clamp-1">{game.title}</CardTitle>
                                <CardDescription className="line-clamp-2 text-xs leading-relaxed font-medium">{game.description}</CardDescription>
                            </CardHeader>
                            <CardFooter className="px-5 pb-5 pt-0 mt-auto flex items-center justify-between border-none">
                                <div className="flex items-center gap-1.5">
                                    <Play className="h-3 w-3 text-muted-foreground opacity-50" />
                                    <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{game.playCount || 0} Sessions</span>
                                </div>
                                {highScores[game.id] !== undefined && (
                                    <div className="flex items-center gap-1 text-accent">
                                        <Trophy className="h-3 w-3 fill-current" />
                                        <span className="text-[10px] font-black">{highScores[game.id]}</span>
                                    </div>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                    
                    {filteredGames.length === 0 && (
                        <div className="col-span-full py-20 text-center space-y-4 bg-muted/10 rounded-[2rem] border-2 border-dashed">
                            <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No games found</p>
                                <p className="text-xs text-muted-foreground/60">Try adjusting your filters or search term.</p>
                            </div>
                            <Button variant="outline" onClick={() => { setSearch(''); setSubject('All Subjects'); setGrade('All Grades'); }}>Reset Explorer</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
