
'use client';

import * as React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { ResultsMetricsView } from '@/components/shared/results-metrics-view';

export default function SchoolHeadResultsMetricsPage() {
    const { user } = useUser();

    if (!user) {
        return null; // Or a loading spinner
    }

    return <ResultsMetricsView user={user} />;
}

    