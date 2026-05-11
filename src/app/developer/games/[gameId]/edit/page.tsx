'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { GameUploader } from '@/components/sandbox/game-uploader';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Game } from '@/lib/types';

export default function EditGamePage() {
  const { gameId } = useParams();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  
  const [game, setGame] = React.useState<Game | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !gameId) return;

    const unsub = onSnapshot(doc(firestore, 'games', gameId as string), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Game;
        setGame(data);
      } else {
        setGame(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [firestore, gameId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading game details...</p>
        </div>
      </div>
    );
  }

  // Security check: ensure user owns the game
  const isOwner = game && user && game.developerId === user.uid;

  if (!game || !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <div className="bg-muted p-4 rounded-full">
            <ArrowLeft className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
            <h1 className="text-2xl font-bold">Game Not Found</h1>
            <p className="text-muted-foreground">The game you are trying to edit either doesn't exist or you don't have permission to modify it.</p>
        </div>
        <Button asChild variant="outline">
          <AppLink href="/developer/dashboard">Return to Dashboard</AppLink>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto">
      <div>
        <Button asChild variant="ghost" className="-ml-4 mb-4">
          <AppLink href="/developer/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </AppLink>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight italic uppercase">Edit Game: <span className="text-primary">{game.title}</span></h1>
        <p className="text-muted-foreground">
          Modify metadata or upload a new version of your game. All updates require admin re-approval.
        </p>
      </div>

      <div className="py-6">
        <GameUploader existingGame={game} />
      </div>
    </div>
  );
}
