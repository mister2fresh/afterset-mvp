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

	if (compact) {
		return <CompactTable rows={sorted} showPageColumn={showPageColumn} />;
	}

	return (
		<>
			{/* Mobile: card view */}
			<div className="space-y-2 md:hidden">
				<SortBar sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
				{sorted.map((row) => (
					<CaptureCard key={row.id} row={row} showPage={showPageColumn} />
				))}
			</div>

			{/* Desktop: table view */}
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>
								<SortButton
									active={sortKey === "email"}
									dir={sortDir}
									onClick={() => toggleSort("email")}
								>
									Email
								</SortButton>
							</TableHead>
							{showPageColumn && (
								<TableHead>
									<SortButton
										active={sortKey === "page_title"}
										dir={sortDir}
										onClick={() => toggleSort("page_title")}
									>
										Page
									</SortButton>
								</TableHead>
							)}
							<TableHead>Method</TableHead>
							<TableHead>
								<SortButton
									active={sortKey === "captured_at"}
									dir={sortDir}
									onClick={() => toggleSort("captured_at")}
								>
									Date
								</SortButton>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sorted.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="font-medium">{row.email}</TableCell>
								{showPageColumn && (
									<TableCell>
										<PageLink row={row} />
									</TableCell>
								)}
								<TableCell>
									<MethodBadge method={row.entry_method} />
								</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(row.captured_at)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

function CaptureCard({ row, showPage }: { row: CaptureRow; showPage: boolean }) {
	return (
		<div className="rounded-lg border border-border p-3">
			<div className="flex items-start justify-between gap-2">
				<p className="min-w-0 truncate text-sm font-medium">{row.email}</p>
				<MethodBadge method={row.entry_method} />
			</div>
			<div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
				<span>{formatDate(row.captured_at)}</span>
				{showPage && (
					<>
						<span>·</span>
						<PageLink row={row} className="truncate" />
					</>
				)}
			</div>
		</div>
	);
}

function SortBar({
	sortKey,
	sortDir,
	onToggle,
}: {
	sortKey: SortKey;
	sortDir: SortDir;
	onToggle: (key: SortKey) => void;
}) {
	const options: { key: SortKey; label: string }[] = [
		{ key: "captured_at", label: "Date" },
		{ key: "email", label: "Email" },
		{ key: "page_title", label: "Page" },
	];
	return (
		<div className="flex items-center gap-1">
			<span className="mr-1 text-xs text-muted-foreground">Sort:</span>
			{options.map((opt) => {
				const active = sortKey === opt.key;
				return (
					<button
						key={opt.key}
						type="button"
						onClick={() => onToggle(opt.key)}
						className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${active ? "bg-muted text-foreground" : "text-muted-foreground"}`}
					>
						{opt.label}
						{active && (sortDir === "asc" ? " ↑" : " ↓")}
					</button>
				);
			})}
		</div>
	);
}

function CompactTable({ rows, showPageColumn }: { rows: CaptureRow[]; showPageColumn: boolean }) {
	return (
		<>
			{/* Mobile: compact cards */}
			<div className="space-y-2 md:hidden">
				{rows.map((row) => (
					<div
						key={row.id}
						className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
					>
						<p className="min-w-0 truncate text-sm">{row.email}</p>
						<span className="shrink-0 text-xs text-muted-foreground">
							{formatDateShort(row.captured_at)}
						</span>
					</div>
				))}
			</div>

			{/* Desktop: compact table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							{showPageColumn && <TableHead>Page</TableHead>}
							<TableHead>Date</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.id}>
								<TableCell className="text-sm">{row.email}</TableCell>
								{showPageColumn && (
									<TableCell className="text-sm">
										<PageLink row={row} />
									</TableCell>
								)}
								<TableCell className="text-muted-foreground">
									{formatDateShort(row.captured_at)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</>
	);
}

function PageLink({ row, className }: { row: CaptureRow; className?: string }) {
	if (row.page_id) {
		return (
			<Link to="/pages" className={`text-electric-blue hover:underline ${className ?? ""}`}>
				{row.page_title}
			</Link>
		);
	}
	return <span className={`text-muted-foreground ${className ?? ""}`}>{row.page_title}</span>;
}

function MethodBadge({ method }: { method: string }) {
	return (
		<Badge variant={METHOD_VARIANTS[method] ?? "secondary"} className="text-[10px]">
			{METHOD_LABELS[method] ?? method}
		</Badge>
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
