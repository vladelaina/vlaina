/**
 * Type declarations for ical.js
 * 
 * ical.js doesn't ship with TypeScript types, so we declare the parts we use.
 */

declare module 'ical.js' {
    export function parse(input: string): unknown[];

    export class Component {
        constructor(jCal: unknown[] | string, parent?: Component);

        getAllSubcomponents(name: string): Component[];
        getFirstSubcomponent(name: string): Component | null;
        addSubcomponent(component: Component): void;
        removeSubcomponent(component: Component | string): boolean;

        getFirstProperty(name: string): Property | null;
        getFirstPropertyValue(name: string): unknown;
        addProperty(property: Property): void;

        toJSON(): unknown[];
        toString(): string;
    }

    export class Event {
        constructor(component: Component, options?: { strictExceptions?: boolean; exceptions?: Component[] });

        uid: string;
        summary: string;
        description: string;
        location: string;
        startDate: Time;
        endDate: Time;
        duration: Duration;
        isRecurring(): boolean;
    }

    export class Time {
        constructor(data?: {
            year?: number;
            month?: number;
            day?: number;
            hour?: number;
            minute?: number;
            second?: number;
            isDate?: boolean;
        });

        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
        isDate: boolean;
        zone: Timezone | null;

        toJSDate(): Date;
        static fromJSDate(date: Date, useUtc?: boolean): Time;
        static fromString(str: string): Time;
        toString(): string;
    }

    export class Duration {
        constructor();

        weeks: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isNegative: boolean;

        toSeconds(): number;
        static fromString(str: string): Duration;
    }

    export class Property {
        constructor(jCal: unknown[] | string, parent?: Component);

        name: string;

        getFirstValue(): unknown;
        getValues(): unknown[];
        setValue(value: unknown): void;
        setValues(values: unknown[]): void;

        getParameter(name: string): unknown;
        setParameter(name: string, value: unknown): void;

        toJSON(): unknown[];
    }

    export class Timezone {
        static localTimezone: Timezone;
        static utcTimezone: Timezone;

        tzid: string;

        static fromData(data: unknown): Timezone;
    }

    export class RecurExpansion {
        constructor(options: { component: Component; dtstart: Time });

        next(): Time | null;
        complete: boolean;
    }

    export class Recur {
        constructor(data?: unknown);

        static fromString(str: string): Recur;
        toString(): string;
    }
}
