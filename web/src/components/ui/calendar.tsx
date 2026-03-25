"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

function Calendar({ className, classNames, ...props }: React.ComponentProps<typeof DayPicker>) {
	return (
		<DayPicker
			className={cn("p-3", className)}
			classNames={{
				months: "flex flex-col sm:flex-row gap-2",
				month: "flex flex-col gap-4",
				month_caption: "flex justify-center pt-1 relative items-center text-sm font-medium",
				nav: "flex items-center gap-1",
				button_previous:
					"absolute left-1 top-0 inline-flex size-7 items-center justify-center rounded-md border border-input bg-transparent p-0 text-muted-foreground opacity-50 hover:opacity-100",
				button_next:
					"absolute right-1 top-0 inline-flex size-7 items-center justify-center rounded-md border border-input bg-transparent p-0 text-muted-foreground opacity-50 hover:opacity-100",
				month_grid: "w-full border-collapse space-y-1",
				weekdays: "flex",
				weekday: "w-9 text-[0.8rem] font-normal text-muted-foreground",
				week: "mt-2 flex w-full",
				day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
				day_button:
					"inline-flex size-9 items-center justify-center rounded-md p-0 text-sm font-normal transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring aria-selected:opacity-100",
				range_end: "day-range-end",
				selected:
					"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				today: "bg-accent text-accent-foreground",
				outside:
					"day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
				disabled: "text-muted-foreground opacity-50",
				range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation }) =>
					orientation === "left" ? (
						<ChevronLeft className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					),
			}}
			{...props}
		/>
	);
}

export { Calendar };
