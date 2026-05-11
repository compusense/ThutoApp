'use client';

import * as React from 'react';
import { Maximize2, Loader2, AlertTriangle, Trophy, Clock, X, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

interface GamePlayerProps {
  gameId: string;
  gameUrl: string;
  title: string;
}

export function GamePlayer({ gameId, gameUrl, title }: GamePlayerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isFinished, setIsFinished] = React.useState(false);
  const [results, setResults] = React.useState<{ score: number; timeSpent: number } | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const gameOrigin = React.useMemo(() => {
    try {
      return new URL(gameUrl).origin;
    } catch {
      return '';
    }
  }, [gameUrl]);

  // Safety timeout for loading
  React.useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 12000); // 12s safety timeout
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleMessage = React.useCallback(async (event: MessageEvent) => {
    // Only accept messages from the game origin
    if (event.origin !== gameOrigin && gameOrigin !== '') return;

    const data = event.data;
    if (data?.type === 'GAME_RESULT' && firestore && user) {
      const { score, timeSpent } = data;
      
      setResults({ score, timeSpent });
      setIsFinished(true);

      // Only students record activity and play counts
      if (user.role === 'student') {
          const activityData = {
              gameId,
              studentId: user.uid,
              score: Number(score),
              timeSpent: Number(timeSpent),
              completedAt: new Date().toISOString(),
          };

          const activityCollection = collection(firestore, 'gameActivity');
          addDoc(activityCollection, activityData)
            .catch(async (serverError) => {
              const permissionError = new FirestorePermissionError({
                  path: 'gameActivity',
                  operation: 'create',
                  requestResourceData: activityData,
              } satisfies SecurityRuleContext);
              errorEmitter.emit('permission-error', permissionError);
            });

          const gameRef = doc(firestore, 'games', gameId);
          updateDoc(gameRef, {
              playCount: increment(1)
          }).catch(async (serverError) => {
              const permissionError = new FirestorePermissionError({
                  path: gameRef.path,
                  operation: 'update',
                  requestResourceData: { playCount: 'increment(1)' },
              } satisfies SecurityRuleContext);
              errorEmitter.emit('permission-error', permissionError);
          });

          toast({
            title: "Achievement Unlocked!",
            description: `Your score of ${score} has been saved to your profile.`,
          });
      } else {
          // Developer/Admin test mode
          toast({
              title: "Test Mode Complete",
              description: `Result received: ${score} points. (No data recorded for non-student users)`,
          });
      }
    }
  }, [gameOrigin, gameId, toast, firestore, user]);

  React.useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  const toggleFullScreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      }
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError("Failed to load the game assets. Please refresh or try another game.");
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black rounded-lg">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/10 border-b border-white/10 shrink-0">
        <h3 className="font-bold text-white tracking-tight truncate max-w-[70%]">{title}</h3>
        <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="h-8 text-xs font-bold" onClick={toggleFullScreen} disabled={isLoading || !!error}>
                <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
                Full Screen
            </Button>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-white">
            <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                </div>
            </div>
            <p className="mt-4 text-sm font-bold tracking-widest uppercase animate-pulse">Launching Challenge...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-destructive/10 text-destructive p-8 text-center">
            <XCircle className="h-16 w-16 mb-4 opacity-50" />
            <p className="font-black text-xl mb-2">SYSTEM ERROR</p>
            <p className="text-sm opacity-80 max-w-xs mx-auto">{error}</p>
            <Button variant="outline" className="mt-6 border-destructive hover:bg-destructive hover:text-white" onClick={() => window.location.reload()}>
              Reboot Game
            </Button>
          </div>
        )}

        {isFinished && results && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center space-y-8 p-10 bg-card rounded-3xl shadow-[0_0_50px_-12px_rgba(59,130,246,0.5)] border-2 border-primary/20 max-w-sm w-full mx-4">
                    <div className="relative mx-auto">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                        <div className="relative bg-gradient-to-br from-primary to-blue-700 p-5 rounded-2xl text-white shadow-xl">
                            <Trophy className="h-12 w-12" />
                        </div>
                    </div>
                    
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black tracking-tighter italic">{user?.role === 'student' ? 'VICTORY!' : 'TEST COMPLETE'}</h2>
                        <p className="text-muted-foreground font-medium">{user?.role === 'student' ? 'Session Recorded Successfully' : 'Analytics bypassed for test session'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-muted/50 rounded-2xl border">
                            <p className="text-[10px] uppercase font-black text-primary mb-1 tracking-widest">Score</p>
                            <p className="text-3xl font-black">{results.score}</p>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-2xl border">
                            <p className="text-[10px] uppercase font-black text-primary mb-1 tracking-widest">Time</p>
                            <p className="text-xl font-black mt-1">
                                {Math.floor(results.timeSpent / 60)}m {results.timeSpent % 60}s
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button size="lg" className="rounded-xl font-black h-12 shadow-lg" onClick={() => window.location.reload()}>REPLAY CHALLENGE</Button>
                        <Button variant="ghost" className="text-muted-foreground font-bold" onClick={() => setIsFinished(false)}>VIEW GAME BOARD</Button>
                    </div>
                </div>
            </div>
        )}

        <iframe
          ref={iframeRef}
          src={gameUrl}
          className={cn(
            "w-full h-full border-0 transition-all duration-700",
            isLoading ? "opacity-0 scale-95 grayscale" : "opacity-100 scale-100 grayscale-0"
          )}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-scripts allow-popups allow-modals allow-downloads allow-forms"
          title={title}
        />
      </div>

      <div className="px-4 py-2 bg-white/5 flex items-center justify-between text-[10px] font-bold text-white/40 tracking-widest uppercase shrink-0">
        <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>{user?.role === 'student' ? 'Auto-Save Enabled' : 'Test Mode Enabled'}</span>
        </div>
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Secure Sandbox</span>
        </div>
      </div>
    </div>
  );
}
