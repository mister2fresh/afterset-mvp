import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

type CheckResult = {
	available: boolean;
	reserved?: boolean;
	current?: boolean;
	suggestions?: string[];
};

type KeywordData = {
	keyword: string;
	phone_number: string;
};

export function KeywordDialog({
	pageId,
	pageTitle,
	currentKeyword,
	open,
	onOpenChange,
}: {
	pageId: string;
	pageTitle: string;
	currentKeyword?: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [value, setValue] = useState(currentKeyword ?? "");
	const [check, setCheck] = useState<CheckResult | null>(null);
	const [checking, setChecking] = useState(false);
	const [debouncing, setDebouncing] = useState(false);

	useEffect(() => {
		if (open) {
			setValue(currentKeyword ?? "");
			setCheck(null);
			setDebouncing(false);
		}
	}, [open, currentKeyword]);

	const checkAvailability = useCallback(
		async (keyword: string) => {
			if (keyword.length < 2) {
				setCheck(null);
				setDebouncing(false);
				return;
			}
			setChecking(true);
			setDebouncing(false);
			try {
				const result = await api.post<CheckResult>(`/capture-pages/${pageId}/keyword/check`, {
					keyword,
				});
				setCheck(result);
			} catch {
				setCheck(null);
			} finally {
				setChecking(false);
			}
		},
		[pageId],
	);

	useEffect(() => {
		const clean = value.replace(/[^A-Za-z0-9]/g, "");
		if (clean.length >= 2) {
			setDebouncing(true);
		}
		const timer = setTimeout(() => {
			if (clean.length >= 2) checkAvailability(clean);
			else {
				setCheck(null);
				setDebouncing(false);
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [value, checkAvailability]);

	function handleInput(raw: string) {
		const clean = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
		setValue(clean);
	}

	const saveMutation = useMutation({
		mutationFn: (keyword: string) =>
			api.put<KeywordData>(`/capture-pages/${pageId}/keyword`, { keyword }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
			onOpenChange(false);
		},
	});

	const removeMutation = useMutation({
		mutationFn: () => api.delete(`/capture-pages/${pageId}/keyword`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["keywords"] });
			onOpenChange(false);
		},
	});

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!value || value.length < 2) return;
		saveMutation.mutate(value);
	}

	const canSave =
		value.length >= 2 &&
		!checking &&
		!debouncing &&
		check &&
		(check.available || check.current) &&
		value.toUpperCase() !== currentKeyword;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display flex items-center gap-2">
						<MessageSquare className="size-5" />
						Text-to-Join Keyword
					</DialogTitle>
					<DialogDescription>
						Set the keyword fans text to get the link for "{pageTitle}".
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label>Keyword</Label>
						<div className="relative">
							<Input
								placeholder="e.g. JDOE"
								value={value.toUpperCase()}
								onChange={(e) => handleInput(e.target.value)}
								maxLength={20}
								className="pr-10 uppercase"
							/>
							<div className="absolute inset-y-0 right-3 flex items-center">
								<StatusIcon checking={checking || debouncing} check={check} value={value} />
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							2–20 characters, letters and numbers only.
						</p>
					</div>

					<StatusMessage check={check} />

					{check && !check.available && !check.reserved && check.suggestions && (
						<SuggestionChips suggestions={check.suggestions} onSelect={(s) => setValue(s)} />
					)}

					{saveMutation.isError && (
						<p className="text-sm text-destructive">{saveMutation.error.message}</p>
					)}

					<DialogFooter className="gap-2 sm:gap-0">
						{currentKeyword && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="mr-auto text-destructive hover:text-destructive"
								onClick={() => removeMutation.mutate()}
								disabled={removeMutation.isPending}
							>
								{removeMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
								Remove
							</Button>
						)}
						<Button type="submit" disabled={!canSave || saveMutation.isPending}>
							{saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Check />}
							{currentKeyword ? "Update" : "Claim"} Keyword
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function StatusIcon({
	checking,
	check,
	value,
}: {
	checking: boolean;
	check: CheckResult | null;
	value: string;
}) {
	if (value.length < 2) return null;
	if (checking) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
	if (!check) return null;
	if (check.available || check.current) return <Check className="size-4 text-green-500" />;
	return <X className="size-4 text-destructive" />;
}

function StatusMessage({ check }: { check: CheckResult | null }) {
	if (!check || check.available || check.current) return null;

	if (check.reserved) {
		return (
			<div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
				<AlertCircle className="size-4 shrink-0" />
				This keyword is reserved for SMS compliance.
			</div>
		);
	}

	return (
		<p className="text-sm text-destructive">
			This keyword is already taken. Try one of the suggestions below.
		</p>
	);
}

function SuggestionChips({
	suggestions,
	onSelect,
}: {
	suggestions: string[];
	onSelect: (s: string) => void;
}) {
	if (suggestions.length === 0) return null;

	return (
		<div className="space-y-1.5">
			<p className="text-xs text-muted-foreground">Available alternatives:</p>
			<div className="flex flex-wrap gap-2">
				{suggestions.map((s) => (
					<button
						key={s}
						type="button"
						onClick={() => onSelect(s)}
						className="rounded-full border border-border px-3 py-1 font-mono text-xs transition-colors hover:border-honey-gold hover:text-honey-gold"
					>
						{s}
					</button>
				))}
			</div>
		</div>
	);
}
