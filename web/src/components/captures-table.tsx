import { Link } from "@tanstack/react-router";
import { ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

export type CaptureRow = {
	id: string;
	email: string;
	fan_name: string | null;
	entry_method: "direct" | "qr" | "nfc" | "sms";
	captured_at: string;
	page_id: string | null;
	page_title: string;
	page_slug: string | null;
};

const METHOD_LABELS: Record<string, string> = {
	direct: "Direct",
	qr: "QR Code",
	nfc: "NFC",
	sms: "SMS",
};

const METHOD_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
	direct: "secondary",
	qr: "default",
	nfc: "outline",
	sms: "outline",
};

type SortKey = "captured_at" | "email" | "page_title";
type SortDir = "asc" | "desc";

export function CapturesTable({
	rows,
	showPageColumn = true,
	compact = false,
}: {
	rows: CaptureRow[];
	showPageColumn?: boolean;
	compact?: boolean;
}) {
	const [sortKey, setSortKey] = useState<SortKey>("captured_at");
	const [sortDir, setSortDir] = useState<SortDir>("desc");

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir(key === "captured_at" ? "desc" : "asc");
		}
	}

	const sorted = useMemo(() => {
		return [...rows].sort((a, b) => {
			const av = a[sortKey];
			const bv = b[sortKey];
			const cmp = av < bv ? -1 : av > bv ? 1 : 0;
			return sortDir === "asc" ? cmp : -cmp;
		});
	}, [rows, sortKey, sortDir]);

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>
						{compact ? (
							"Email"
						) : (
							<SortButton
								active={sortKey === "email"}
								dir={sortDir}
								onClick={() => toggleSort("email")}
							>
								Email
							</SortButton>
						)}
					</TableHead>
					{showPageColumn && (
						<TableHead>
							{compact ? (
								"Page"
							) : (
								<SortButton
									active={sortKey === "page_title"}
									dir={sortDir}
									onClick={() => toggleSort("page_title")}
								>
									Page
								</SortButton>
							)}
						</TableHead>
					)}
					{!compact && <TableHead>Method</TableHead>}
					<TableHead>
						{compact ? (
							"Date"
						) : (
							<SortButton
								active={sortKey === "captured_at"}
								dir={sortDir}
								onClick={() => toggleSort("captured_at")}
							>
								Date
							</SortButton>
						)}
					</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{sorted.map((row) => (
					<TableRow key={row.id}>
						<TableCell className={compact ? "text-sm" : "font-medium"}>{row.email}</TableCell>
						{showPageColumn && (
							<TableCell className={compact ? "text-sm" : ""}>
								{row.page_id ? (
									<Link to="/pages" className="text-electric-blue hover:underline">
										{row.page_title}
									</Link>
								) : (
									<span className="text-muted-foreground">{row.page_title}</span>
								)}
							</TableCell>
						)}
						{!compact && (
							<TableCell>
								<Badge variant={METHOD_VARIANTS[row.entry_method] ?? "secondary"}>
									{METHOD_LABELS[row.entry_method] ?? row.entry_method}
								</Badge>
							</TableCell>
						)}
						<TableCell className="text-muted-foreground">
							{compact ? formatDateShort(row.captured_at) : formatDate(row.captured_at)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

function SortButton({
	children,
	active,
	dir,
	onClick,
}: {
	children: React.ReactNode;
	active: boolean;
	dir: SortDir;
	onClick: () => void;
}) {
	return (
		<Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1" onClick={onClick}>
			{children}
			<ArrowUpDown
				className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground/50"}`}
			/>
			{active && <span className="sr-only">{dir === "asc" ? "ascending" : "descending"}</span>}
		</Button>
	);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatDateShort(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
