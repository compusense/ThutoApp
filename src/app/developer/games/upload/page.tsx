
import { GameUploader } from '@/components/sandbox/game-uploader';
import { Button } from '@/components/ui/button';
import { AppLink } from '@/components/ui/app-link';
import { ArrowLeft } from 'lucide-react';

export default function GameUploadPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" className="-ml-4">
            <AppLink href="/developer/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Developer Dashboard
            </AppLink>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Upload New Game</h1>
          <p className="text-muted-foreground">
            Share your educational game with students in the Thuto ecosystem.
          </p>
        </div>
      </div>

      <div className="py-6">
        <GameUploader />
      </div>
    </div>
  );
}
