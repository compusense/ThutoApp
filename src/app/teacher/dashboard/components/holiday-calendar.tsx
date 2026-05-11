
'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';

// Public Google Calendar ID for Botswana holidays.
const BOTSWANA_HOLIDAY_CALENDAR_ID = 'en.bw#holiday@group.v.calendar.google.com';

// Encode the calendar ID and add a bright blue color parameter.
const calendarSrc = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(BOTSWANA_HOLIDAY_CALENDAR_ID)}&ctz=Africa/Gaborone&color=%234285F4`;

export function HolidayCalendar() {
  return (
    <Card className="w-full h-[75vh] overflow-hidden">
        <iframe
            src={calendarSrc}
            style={{ borderWidth: 0 }}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            title="Botswana Public Holidays Calendar"
        ></iframe>
    </Card>
  );
}
