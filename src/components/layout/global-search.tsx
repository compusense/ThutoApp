'use client';

import * as React from 'react';
import { Search, Loader2, User, School, ArrowRight, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth } from '@/firebase';
import { 
  Command,
  CommandGroup, 
  CommandItem, 
  CommandList,
  CommandDialog,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { globalSearch } from '@/app/actions/search';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<{ entities: any[] }>({ entities: [] });
  
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close desktop search when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search logic
  React.useEffect(() => {
    const cleanQuery = query.trim();
    if (!cleanQuery || cleanQuery.length < 2) {
      setResults({ entities: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) return;

        const res = await globalSearch(cleanQuery, idToken);
        if (res.success && res.results) {
          setResults(res.results);
          if (!mobileOpen) setOpen(true);
        }
      } catch (err) {
        console.error("Search fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, mobileOpen]);

  const onSelect = (path: string) => {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    router.push(path);
  };

  const renderResults = () => (
    <CommandList className="max-h-[450px] p-3 overflow-y-auto">
      {loading && results.entities.length === 0 && (
        <div className="p-12 text-sm text-center text-muted-foreground flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="font-medium animate-pulse">Searching the registry...</p>
        </div>
      )}
      
      {!loading && results.entities.length === 0 && (
        <div className="p-12 text-center flex flex-col items-center gap-2">
            <Search className="h-10 w-10 text-muted-foreground opacity-20" />
            <p className="text-sm font-medium text-muted-foreground">
                No matches found for "{query}"
            </p>
            <p className="text-xs text-muted-foreground/70">
                Try searching for a name or admission number.
            </p>
        </div>
      )}

      {results.entities.length > 0 && (
        <CommandGroup heading="Registry Matches">
          {results.entities.map((entity, idx) => (
            <CommandItem 
              key={entity.id} 
              value={`entity-${entity.id}-${idx}`}
              onSelect={() => onSelect(entity.path)}
              className="flex flex-col items-start gap-2 p-4 rounded-lg cursor-pointer hover:bg-accent border border-transparent hover:border-border mb-2"
            >
                <div className="flex items-center gap-3 w-full">
                  <div className="bg-muted p-2 rounded-md">
                    {entity.type === 'student' ? <User className="h-5 w-5 text-foreground" /> : 
                     entity.type === 'staff' ? <UserCog className="h-5 w-5 text-foreground" /> :
                     <School className="h-5 w-5 text-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base leading-none">{entity.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{entity.subtitle}</p>
                  </div>
                </div>
                
                {entity.actions && (
                  <div className="flex flex-wrap gap-2 mt-1 w-full pl-11">
                    {entity.actions.map((action: any) => (
                      <Button 
                        key={action.label} 
                        size="sm" 
                        variant="secondary" 
                        className="h-8 text-xs font-semibold px-3 bg-secondary/80 hover:bg-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(action.path);
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </CommandItem>
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );

  return (
    <>
      {/* Desktop Version: Inline Input */}
      <div ref={containerRef} className="relative w-full max-w-xl group hidden md:block">
        <Command 
          className="rounded-lg border shadow-sm bg-background overflow-visible"
          shouldFilter={false}
        >
          <div className="flex items-center px-4 py-1" cmdk-input-wrapper="">
            <Search className="mr-3 h-5 w-5 shrink-0 text-muted-foreground opacity-70" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search registry..."
              value={query}
              onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />}
            {query && !loading && (
                <button 
                  onClick={() => { setQuery(''); setOpen(false); }}
                  className="ml-2 text-muted-foreground hover:text-foreground"
                >
                    <Badge variant="secondary" className="px-1 text-[10px]">ESC</Badge>
                </button>
            )}
          </div>
          
          {open && (query.trim().length >= 2 || loading) && (
            <div className="absolute top-full left-0 z-[100] w-full mt-2 rounded-xl border bg-popover text-popover-foreground shadow-2xl outline-none animate-in fade-in-0 zoom-in-95">
              {renderResults()}
            </div>
          )}
        </Command>
      </div>

      {/* Mobile Version: Icon Trigger + Dialog */}
      <div className="md:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9">
          <Search className="h-5 w-5" />
        </Button>
        <CommandDialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <div className="flex items-center px-4 py-2 border-b" cmdk-input-wrapper="">
             <Search className="mr-3 h-5 w-5 shrink-0 opacity-50" />
             <input 
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search students, staff or schools..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
             />
             {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />}
          </div>
          <div className="p-0">
             {(query.trim().length >= 2 || loading) ? renderResults() : (
               <div className="p-12 text-center text-sm text-muted-foreground">
                 <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                 <p>Enter at least 2 characters to search the registry.</p>
               </div>
             )}
          </div>
        </CommandDialog>
      </div>
    </>
  );
}
