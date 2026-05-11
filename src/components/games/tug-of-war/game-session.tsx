'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    doc, 
    updateDoc, 
    onSnapshot,
    limit,
    orderBy,
    increment,
    serverTimestamp,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { UserProfile } from '@/firebase/auth/use-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    Trophy, 
    Users, 
    Timer, 
    Zap, 
    Star, 
    Target,
    Loader2,
    Swords,
    RotateCcw,
    XCircle,
    CheckCircle2,
    Flag,
    LogOut,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

interface TugOfWarGameProps {
  user: UserProfile;
}

type GameStatus = 'waiting' | 'starting' | 'active' | 'finished' | 'expired';

interface PlayerState {
    uid: string;
    name: string;
    score: number;
    correct: number;
    total: number;
    speedStars: number;
}

interface GameSession {
    id: string;
    p1: PlayerState;
    p2: PlayerState | null;
    status: GameStatus;
    winner: string | null;
    lastActiveAt?: Timestamp;
    reason?: 'surrender' | 'timeout';
}

export function TugOfWarGame({ user }: TugOfWarGameProps) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [session, setSession] = React.useState<GameSession | null>(null);
    const [isMatching, setIsMatching] = React.useState(false);
    const [countdown, setCountdown] = React.useState<number | null>(null);
    const [currentQuestion, setCurrentQuestion] = React.useState<any>(null);
    const [answerFeedback, setAnswerFeedback] = React.useState<'correct' | 'wrong' | null>(null);
    const [qTimer, setQTimer] = React.useState(10);
    const qTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = React.useRef<number>(0);

    const isP1 = React.useMemo(() => !!(session?.p1?.uid === user?.uid), [session?.p1?.uid, user?.uid]);
    const myState = isP1 ? session?.p1 : session?.p2;
    const opponentState = isP1 ? session?.p2 : session?.p1;

    // --- REAL-TIME LISTENER ---
    React.useEffect(() => {
        if (!firestore || !session?.id) return;

        const unsub = onSnapshot(doc(firestore, 'tugOfWarSessions', session.id), (snap) => {
            if (snap.exists()) {
                const data = snap.data() as GameSession;
                setSession({ id: snap.id, ...data });
                
                if (data.status === 'finished' || data.status === 'expired') {
                    stopGame();
                }
            }
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `tugOfWarSessions/${session?.id}`,
                operation: 'get',
            }));
        });

        return () => unsub();
    }, [firestore, session?.id]);

    // --- INACTIVITY WATCHER ---
    React.useEffect(() => {
        if (!session || session.status !== 'active') return;

        const interval = setInterval(() => {
            const now = Date.now();
            const lastActive = session.lastActiveAt?.toMillis() || now;
            const diff = (now - lastActive) / 1000;

            if (diff >= 40) {
                handleExpiration();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [session?.status, session?.lastActiveAt]);

    const handleExpiration = async () => {
        if (!session || session.status !== 'active') return;
        const sessionRef = doc(firestore!, 'tugOfWarSessions', session.id);
        updateDoc(sessionRef, { 
            status: 'expired',
            reason: 'timeout'
        });
    };

    // --- GAME ENGINE ---
    const generateQuestion = () => {
        const ops = ['+', '-', '*'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a, b, ans;

        if (op === '*') {
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            ans = a * b;
        } else if (op === '+') {
            a = Math.floor(Math.random() * 50) + 1;
            b = Math.floor(Math.random() * 50) + 1;
            ans = a + b;
        } else {
            a = Math.floor(Math.random() * 50) + 25;
            b = Math.floor(Math.random() * 25) + 1;
            ans = a - b;
        }

        const options = new Set([ans]);
        while (options.size < 4) {
            options.add(ans + (Math.floor(Math.random() * 10) - 5));
        }

        setCurrentQuestion({
            text: `${a} ${op === '*' ? '×' : op} ${b}`,
            answer: ans,
            options: Array.from(options).sort(() => Math.random() - 0.5)
        });
        
        setQTimer(10);
        startTimeRef.current = Date.now();
        setAnswerFeedback(null);
    };

    const startGame = () => {
        generateQuestion();
        qTimerRef.current = setInterval(() => {
            setQTimer(prev => {
                if (prev <= 1) {
                    handleAnswer(null);
                    return 10;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopGame = () => {
        if (qTimerRef.current) clearInterval(qTimerRef.current);
    };

    const updatePermanentScore = async (isWin: boolean) => {
        if (!firestore || !user?.uid) return;
        const userRef = doc(firestore, 'users', user.uid);
        const delta = isWin ? 20 : -10;
        
        updateDoc(userRef, {
            tugOfWarScore: increment(delta)
        }).catch(e => console.error("Score update failed", e));
    };

    const handleAnswer = async (choice: number | null) => {
        if (!session || session.status !== 'active' || !currentQuestion) return;

        const isCorrect = choice === currentQuestion.answer;
        const timeTaken = (Date.now() - startTimeRef.current) / 1000;
        
        let pointDelta = isCorrect ? 10 : -5;
        let speedStarDelta = 0;
        
        if (isCorrect && timeTaken < 5) {
            pointDelta += 5;
            speedStarDelta = 1;
        }

        const newScore = Math.max(0, (myState?.score || 0) + pointDelta);
        const newCorrect = (myState?.correct || 0) + (isCorrect ? 1 : 0);
        const newTotal = (myState?.total || 0) + 1;
        const newSpeedStars = (myState?.speedStars || 0) + speedStarDelta;

        setAnswerFeedback(isCorrect ? 'correct' : 'wrong');

        const update: any = {};
        const playerKey = isP1 ? 'p1' : 'p2';
        update[playerKey] = {
            ...myState,
            score: newScore,
            correct: newCorrect,
            total: newTotal,
            speedStars: newSpeedStars
        };
        update.lastActiveAt = serverTimestamp();

        if (newScore >= 200) {
            update.status = 'finished';
            update.winner = user.uid;
            updatePermanentScore(true);
            // The listener for the other player will handle their score deduction
        }

        const sessionRef = doc(firestore!, 'tugOfWarSessions', session.id);
        updateDoc(sessionRef, update).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: sessionRef.path,
                operation: 'update',
                requestResourceData: update
            } satisfies SecurityRuleContext));
        });

        setTimeout(() => {
            if (newScore < 200) generateQuestion();
        }, 600);
    };

    const handleSurrender = async () => {
        if (!session || !firestore || session.status !== 'active') return;
        
        const winnerId = isP1 ? session.p2?.uid : session.p1.uid;
        const sessionRef = doc(firestore, 'tugOfWarSessions', session.id);
        
        await updateDoc(sessionRef, {
            status: 'finished',
            winner: winnerId || 'Opponent',
            reason: 'surrender'
        });
        
        updatePermanentScore(false);
        toast({ title: "Surrendered", description: "You have left the match. -10 pts deducted." });
    };

    // --- MATCHMAKING ---
    const findMatch = async () => {
        setIsMatching(true);
        try {
            const q = query(
                collection(firestore!, 'tugOfWarSessions'),
                where('status', '==', 'waiting'),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                const matchDoc = snap.docs[0];
                const matchData = matchDoc.data();
                
                if (matchData.p1.uid === user.uid) {
                    setSession({ id: matchDoc.id, ...matchData } as GameSession);
                    setIsMatching(false);
                    return;
                }

                const sessionRef = doc(firestore!, 'tugOfWarSessions', matchDoc.id);
                const update = {
                    p2: {
                        uid: user.uid,
                        name: user.displayName || 'Player 2',
                        score: 0,
                        correct: 0,
                        total: 0,
                        speedStars: 0
                    },
                    status: 'starting',
                    startAt: serverTimestamp(),
                    lastActiveAt: serverTimestamp()
                };
                
                await updateDoc(sessionRef, update);
                startCountdown(matchDoc.id, update as any);
            } else {
                const newSession = {
                    p1: {
                        uid: user.uid,
                        name: user.displayName || 'Player 1',
                        score: 0,
                        correct: 0,
                        total: 0,
                        speedStars: 0
                    },
                    p2: null,
                    status: 'waiting',
                    winner: null,
                    createdAt: serverTimestamp(),
                    lastActiveAt: serverTimestamp()
                };
                const docRef = await addDoc(collection(firestore!, 'tugOfWarSessions'), newSession);
                setSession({ id: docRef.id, ...newSession } as GameSession);
            }
        } catch (e: any) {
            console.error('[Matchmaking Error] Details:', e);
            toast({ 
                variant: 'destructive', 
                title: 'Matchmaking Error', 
                description: 'Matchmaking failed. Please try again.' 
            });
        } finally {
            setIsMatching(false);
        }
    };

    const startCountdown = (id: string, initialData: GameSession) => {
        setSession({ id, ...initialData });
        let count = 3;
        setCountdown(count);
        const timer = setInterval(() => {
            count--;
            setCountdown(count);
            if (count <= 0) {
                clearInterval(timer);
                setCountdown(null);
                const sessionRef = doc(firestore!, 'tugOfWarSessions', id);
                updateDoc(sessionRef, { status: 'active' });
            }
        }, 1000);
    };

    const ropePosition = React.useMemo(() => {
        if (!session) return 50;
        const p1Score = session.p1?.score || 0;
        const p2Score = session.p2?.score || 0;
        const diff = p1Score - p2Score;
        const clampedDiff = Math.max(-200, Math.min(200, diff));
        return 50 + (clampedDiff / 400) * 100;
    }, [session?.p1?.score, session?.p2?.score]);

    React.useEffect(() => {
        if (session?.status === 'active' && !currentQuestion) {
            startGame();
        }
    }, [session?.status, currentQuestion]);

    // Handle losing points when the match finishes and you are not the winner
    React.useEffect(() => {
        if (session?.status === 'finished' && session.winner && session.winner !== user.uid) {
            updatePermanentScore(false);
        }
    }, [session?.status, session?.winner]);

    if (!session) {
        return (
            <Card className="border-4 border-primary/20 shadow-xl overflow-hidden rounded-3xl">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-8 md:p-12 text-center text-white space-y-6">
                    <div className="mx-auto bg-white/20 p-4 rounded-full w-fit animate-bounce">
                        <Swords className="h-12 w-12" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic">MATH TUG-OF-WAR</h1>
                        <p className="text-lg font-medium opacity-90">Speed + Accuracy = Victory!</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-xl mx-auto">
                        <div className="bg-white/10 p-3 rounded-2xl">
                            <Zap className="mx-auto h-5 w-5 mb-1 text-yellow-300" />
                            <p className="text-xs font-bold uppercase tracking-wider">Fast Answers</p>
                            <p className="text-[10px] opacity-70">+5 Bonus Points</p>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl">
                            <Target className="mx-auto h-5 w-5 mb-1 text-green-300" />
                            <p className="text-xs font-bold uppercase tracking-wider">Win Rank</p>
                            <p className="text-[10px] opacity-70">+20 Global Pts</p>
                        </div>
                        <div className="bg-white/10 p-3 rounded-2xl">
                            <XCircle className="mx-auto h-5 w-5 mb-1 text-red-300" />
                            <p className="text-xs font-bold uppercase tracking-wider">Surrender</p>
                            <p className="text-[10px] opacity-70">-10 Global Pts</p>
                        </div>
                    </div>
                    <Button 
                        size="lg" 
                        onClick={findMatch} 
                        disabled={isMatching}
                        className="w-full max-w-xs h-14 text-xl font-black rounded-2xl bg-accent text-accent-foreground hover:scale-105 transition-transform shadow-2xl"
                    >
                        {isMatching ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "FIND BATTLE!"}
                    </Button>
                </div>
            </Card>
        );
    }

    if (session.status === 'waiting') {
        return (
            <Card className="p-12 md:p-20 text-center space-y-6 border-4 border-dashed rounded-3xl animate-pulse">
                <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                    <div className="relative bg-muted p-6 rounded-full flex items-center justify-center">
                        <Users className="h-12 w-12 text-primary" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-black tracking-tight">Looking for an opponent...</h2>
                    <p className="text-muted-foreground font-medium text-sm">Warm up your math muscles!</p>
                </div>
                <Button variant="ghost" onClick={async () => {
                    await deleteDoc(doc(firestore!, 'tugOfWarSessions', session.id));
                    setSession(null);
                }}>Cancel Search</Button>
            </Card>
        );
    }

    if (countdown !== null) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center animate-bounce">
                    <p className="text-8xl font-black text-primary drop-shadow-2xl">{countdown}</p>
                    <p className="text-xl font-bold uppercase tracking-widest mt-2">Get Ready!</p>
                </div>
            </div>
        );
    }

    if (session.status === 'expired') {
        return (
            <Card className="p-10 text-center space-y-4 max-w-md mx-auto rounded-3xl border-4">
                <AlertCircle className="h-12 w-12 mx-auto text-amber-500" />
                <h2 className="text-2xl font-black">MATCH EXPIRED</h2>
                <p className="text-muted-foreground text-sm">Both players were inactive for too long. No points were awarded.</p>
                <Button onClick={() => setSession(null)} className="w-full">BACK TO HUB</Button>
            </Card>
        );
    }

    if (session.status === 'finished') {
        const isWinner = session.winner === user.uid;
        const accuracy = myState ? Math.round((myState.correct / Math.max(1, myState.total)) * 100) : 0;
        const pointsLabel = isWinner ? "+20" : "-10";

        return (
            <Card className="border-8 border-primary/20 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-500 max-w-2xl mx-auto">
                <div className={cn("p-10 text-center text-white relative", isWinner ? "bg-green-500" : "bg-red-500")}>
                    {session.reason === 'surrender' && (
                        <Badge className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/30 border-none font-bold">
                            {isWinner ? "OPPONENT LEFT" : "YOU LEFT"}
                        </Badge>
                    )}
                    
                    <div className="mx-auto mb-6 relative">
                        <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full" />
                        {isWinner ? <Trophy className="h-24 w-24 mx-auto relative" /> : <XCircle className="h-24 w-24 mx-auto relative opacity-50" />}
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic mb-2">
                        {isWinner ? "YOU WON!" : "GOOD EFFORT!"}
                    </h2>
                    <p className="text-xl font-black mb-8 opacity-90 tracking-widest">{pointsLabel} GLOBAL POINTS</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
                        <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Session Score</p>
                            <p className="text-2xl font-black">{myState?.score}</p>
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Accuracy</p>
                            <p className="text-2xl font-black">{accuracy}%</p>
                        </div>
                        <div className="bg-black/20 p-4 rounded-2xl backdrop-blur-sm col-span-2 md:col-span-1">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Speed Stars</p>
                            <div className="flex justify-center gap-1">
                                {Array.from({ length: Math.min(5, myState?.speedStars || 0) }).map((_, i) => (
                                    <Star key={i} className="h-4 w-4 fill-yellow-300 text-yellow-300 animate-pulse" />
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => setSession(null)} size="lg" className="h-14 px-8 text-xl font-black rounded-2xl bg-white text-black hover:bg-muted shadow-xl">
                        <RotateCcw className="mr-2 h-6 w-6" /> LOBBY
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-10">
            {/* Header: Scoreboard */}
            <div className="flex justify-between items-center bg-card p-4 rounded-3xl border-4 border-primary/10 shadow-lg relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-red-500/5" />
                
                <div className="text-left relative z-10 space-y-0.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-blue-600">Player 1 (Blue)</p>
                    <p className="text-lg font-black truncate max-w-[120px]">{session.p1.name}</p>
                    <p className="text-3xl font-black text-blue-600">{session.p1.score}</p>
                </div>

                <div className="text-center relative z-10 bg-muted/50 p-2 px-4 rounded-2xl border-2 border-dashed">
                    <Timer className={cn("h-6 w-6 mx-auto mb-0.5", qTimer < 3 ? "text-red-500 animate-ping" : "text-muted-foreground")} />
                    <p className="text-xl font-black tabular-nums">{qTimer}s</p>
                </div>

                <div className="text-right relative z-10 space-y-0.5">
                    <p className="text-[8px] font-black uppercase tracking-widest text-red-600">Player 2 (Red)</p>
                    <p className="text-lg font-black truncate max-w-[120px]">{session.p2?.name || 'Joining...'}</p>
                    <p className="text-3xl font-black text-red-600">{session.p2?.score || 0}</p>
                </div>
            </div>

            {/* Battleground: Tug of War Animation */}
            <Card className="p-6 bg-gradient-to-b from-muted/20 to-muted/50 border-4 rounded-[2.5rem] shadow-inner relative overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-white/20 border-x border-dashed border-white/40" />
                <div className="relative h-20 flex items-center">
                    <div className="absolute inset-x-0 h-3 bg-[repeating-linear-gradient(45deg,#8b5e3c,#8b5e3c_10px,#a67c52_10px,#a67c52_20px)] rounded-full border-4 border-black/10 shadow-lg" />
                    <div 
                        className="absolute h-12 w-10 transition-all duration-500 ease-out"
                        style={{ left: `${ropePosition}%`, transform: 'translateX(-50%)' }}
                    >
                        <div className="relative h-full w-full">
                            <div className="absolute inset-0 bg-yellow-400 rounded-lg shadow-xl border-2 border-white animate-bounce" />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                <Flag className="h-6 w-6 text-white drop-shadow-md fill-red-500" />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-between mt-2 px-2">
                    <div className="flex flex-col items-center">
                        <div className="h-12 w-12 bg-blue-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xl">👤</div>
                        <p className="mt-1 text-[8px] font-black text-blue-600 uppercase">Blue Team</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className="h-12 w-12 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center text-xl">🤖</div>
                        <p className="mt-1 text-[8px] font-black text-red-600 uppercase">Red Team</p>
                    </div>
                </div>
            </Card>

            {/* Player's Interaction Zone */}
            {currentQuestion && (
                <div className="space-y-4 animate-in slide-in-from-bottom duration-500 max-w-2xl mx-auto">
                    <div className="text-center p-6 bg-card rounded-3xl border-4 border-primary/20 shadow-2xl relative overflow-hidden">
                        {answerFeedback && (
                            <div className={cn(
                                "absolute inset-0 z-10 flex items-center justify-center transition-all duration-300",
                                answerFeedback === 'correct' ? "bg-green-500/90" : "bg-red-500/90"
                            )}>
                                {answerFeedback === 'correct' ? (
                                    <CheckCircle2 className="h-20 w-24 text-white animate-in zoom-in" />
                                ) : (
                                    <XCircle className="h-20 w-24 text-white animate-in zoom-in" />
                                )}
                            </div>
                        )}
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Solve this fast!</p>
                        <h3 className="text-6xl font-black tracking-tighter tabular-nums text-primary">{currentQuestion.text}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {currentQuestion.options.map((opt: number) => (
                            <Button 
                                key={opt}
                                variant="outline"
                                size="lg"
                                onClick={() => handleAnswer(opt)}
                                disabled={answerFeedback !== null}
                                className="h-20 text-3xl font-black rounded-2xl border-4 border-muted hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-95 shadow-xl"
                            >
                                {opt}
                            </Button>
                        ))}
                    </div>

                    <div className="flex justify-center pt-6">
                        <Button variant="ghost" className="text-destructive font-black text-xs uppercase tracking-widest hover:bg-destructive/10" onClick={handleSurrender}>
                            <LogOut className="mr-2 h-4 w-4" /> SURRENDER (-10 pts)
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
