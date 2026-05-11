'use client';

import * as React from 'react';
import { useUser, UserProfile } from '@/firebase/auth/use-user';
import { TugOfWarGame } from '@/components/games/tug-of-war/game-session';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Loader2, Medal, Users, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchTugOfWarLeaderboard } from '../actions';
import { cn } from '@/lib/utils';
import { auth } from '@/firebase';

export default function TugOfWarPage() {
  const { user, loading } = useUser();
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [loadingLB, setLoadingLB] = React.useState(true);

  React.useEffect(() => {
    const loadLeaderboard = async () => {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;
      
      setLoadingLB(true);
      try {
        const result = await fetchTugOfWarLeaderboard(idToken);
        if (result.success && result.data) {
          setLeaderboard(result.data);
        }
      } catch (e) {
        console.error("Leaderboard fetch failed:", e);
      } finally {
        setLoadingLB(false);
      }
    };
    loadLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p>This game is for students only.</p>
        <Button asChild className="mt-4">
          <AppLink href="/">Go Home</AppLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" className="-ml-4">
          <AppLink href="/student/games">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Game Center
          </AppLink>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Game Area */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <TugOfWarGame user={user} />
        </div>

        {/* Sidebar: Leaderboard & Info */}
        <div className="space-y-6 order-1 lg:order-2">
          <Card className="rounded-[2rem] border-4 border-primary/10 shadow-xl overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-primary font-black uppercase tracking-tight">
                <Medal className="h-5 w-5 text-accent" />
                Champions
              </CardTitle>
              <CardDescription className="text-[10px]">Tug of War Global Rankings</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLB ? (
                <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : leaderboard.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground italic text-xs">
                  No rankings yet. Start battling!
                </div>
              ) : (
                <div className="divide-y">
                  {leaderboard.map((student, idx) => (
                    <div key={student.uid} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black",
                        idx === 0 ? "bg-yellow-400 text-black shadow-md scale-110" : "bg-muted text-muted-foreground"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm leading-none">{student.displayName}</p>
                        <p className="text-[10px] text-muted-foreground mt-1.5">{student.className || 'Explorer'}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-base text-primary">{student.tugOfWarScore || 0}</p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="bg-muted/5 p-4 rounded-b-2xl border-t border-dashed">
              <p className="text-[10px] text-muted-foreground italic text-center w-full">
                Win: +20 pts | Loss: -10 pts
              </p>
            </CardFooter>
          </Card>

          <Card className="rounded-[2rem] bg-accent/5 border-2 border-dashed border-accent/20">
            <CardHeader className="p-5">
              <CardTitle className="text-sm flex items-center gap-2 font-black uppercase text-accent">
                <Users className="h-4 w-4" />
                Battle Lobby
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                Challenge your classmates! Matchmaking pairs you with the first available student who clicks <b>FIND BATTLE</b>.
              </p>
              <div className="p-3 bg-white/50 rounded-2xl border text-[10px] space-y-2 font-bold">
                <p className="flex items-center gap-2"><CheckCircle2 className="h-3 w-3 text-green-500" /> Correct Answer: +10 pts</p>
                <p className="flex items-center gap-2"><XCircle className="h-3 w-3 text-red-500" /> Wrong Answer: -5 pts</p>
                <p className="flex items-center gap-2 text-primary"><span className="text-yellow-500">⚡</span> Quick Bonus: +5 pts (&lt;5s)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
