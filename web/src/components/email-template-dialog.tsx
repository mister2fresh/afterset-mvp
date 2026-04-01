import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Mail, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
	type EmailTemplate,
	MAX_STEPS,
	SequenceStepEditor,
	StepDelayIcon,
	stepDelayLabel,
} from "./sequence-step-editor";

export function EmailTemplateDialog({
	pageId,
	pageTitle,
	hasIncentive,
	open,
	onOpenChange,
	autoExpandFirst,
}: {
	pageId: string;
	pageTitle: string;
	hasIncentive: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	autoExpandFirst?: boolean;
}) {
	const queryClient = useQueryClient();
	const queryKey = ["email-sequence", pageId];

	const { data: sequence, isLoading } = useQuery({
		queryKey,
		queryFn: () => api.get<EmailTemplate[]>(`/capture-pages/${pageId}/email-sequence`),
		enabled: open,
	});

	const [expandedOrder, setExpandedOrder] = useState<number | null>(autoExpandFirst ? 0 : null);
	const [addingNew, setAddingNew] = useState(false);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey });
		queryClient.invalidateQueries({ queryKey: ["email-sequence-status"] });
	}

	const steps = sequence ?? [];
	const canAddStep = steps.length < MAX_STEPS;
	const nextOrder = steps.length;
	const isNewSequence = steps.length === 0;

	if (isLoading) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-lg">
					<div className="flex items-center justify-center py-12">
						<Loader2 className="size-6 animate-spin text-muted-foreground" />
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="font-display flex items-center gap-2">
						<Mail className="size-5" />
						Email Sequence
					</DialogTitle>
					<DialogDescription>
						{isNewSequence
							? `Add follow-up emails for fans who sign up via "${pageTitle}".`
							: `${steps.length} email${steps.length === 1 ? "" : "s"} in sequence for "${pageTitle}".`}
					</DialogDescription>
				</DialogHeader>

				<div className="mt-4 space-y-3">
					{steps.map((step) => {
						const isExpanded = expandedOrder === step.sequence_order;
						return (
							<div key={step.id} className="rounded-lg border border-border">
								<button
									type="button"
									onClick={() => setExpandedOrder(isExpanded ? null : step.sequence_order)}
									className="flex w-full items-center gap-3 p-3 text-left"
								>
									<div
										className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.sequence_order === 0 ? "bg-honey-gold/20 text-honey-gold" : "bg-muted"}`}
									>
										{step.sequence_order + 1}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{step.subject || "Untitled"}</p>
										<p className="flex items-center gap-1 text-xs text-muted-foreground">
											<StepDelayIcon step={step} />
											{step.sequence_order === 0
												? "Welcome email"
												: `Follow-up · ${stepDelayLabel(step)}`}
										</p>
									</div>
									<Badge
										variant={step.is_active ? "default" : "secondary"}
										className="shrink-0 text-xs"
									>
										{step.is_active ? "Active" : "Draft"}
									</Badge>
									{isExpanded ? (
										<ChevronUp className="size-4 text-muted-foreground" />
									) : (
										<ChevronDown className="size-4 text-muted-foreground" />
									)}
								</button>
								{isExpanded && (
									<div className="border-t border-border p-3">
										<SequenceStepEditor
											pageId={pageId}
											order={step.sequence_order}
											existing={step}
											hasIncentive={hasIncentive}
											onSaved={() => {
												invalidateAll();
												setExpandedOrder(null);
											}}
											onDeleted={() => {
												invalidateAll();
												setExpandedOrder(null);
											}}
										/>
									</div>
								)}
							</div>
						);
					})}

					{addingNew && (
						<div className="rounded-lg border border-honey-gold/50 p-3">
							<p className="mb-3 text-sm font-medium">
								Email #{nextOrder + 1}
								{nextOrder > 0 && " (follow-up)"}
							</p>
							<SequenceStepEditor
								pageId={pageId}
								order={nextOrder}
								existing={undefined}
								hasIncentive={hasIncentive}
								onSaved={() => {
									invalidateAll();
									setAddingNew(false);
								}}
								onDeleted={() => setAddingNew(false)}
							/>
						</div>
					)}
					{canAddStep && !addingNew && (
						<Button
							variant="outline"
							size="sm"
							className="w-full border-dashed"
							onClick={() => {
								setExpandedOrder(null);
								setAddingNew(true);
							}}
						>
							<Plus className="size-4" />
							Add Email
						</Button>
					)}
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function EmailTemplateBadge({ pageId, onClick }: { pageId: string; onClick?: () => void }) {
	const { data, isLoading } = useQuery({
		queryKey: ["email-sequence-status", pageId],
		queryFn: async () => {
			const seq = await api.get<EmailTemplate[]>(`/capture-pages/${pageId}/email-sequence`);
			if (!seq || seq.length === 0) return { total: 0, active: 0 };
			const activeCount = seq.filter((s) => s.is_active).length;
			return { total: seq.length, active: activeCount };
		},
	});

	if (isLoading || !data) return null;

	const noEmail = data.total === 0;
	const label = noEmail
		? "No follow-up email"
		: data.active === data.total
			? `${data.total} email${data.total === 1 ? "" : "s"} active`
			: `${data.active}/${data.total} active`;

	const variant = noEmail ? "destructive" : data.active > 0 ? "default" : "secondary";
	const Icon = noEmail ? AlertTriangle : Mail;

	if (onClick) {
		return (
			<button type="button" onClick={onClick}>
				<Badge
					variant={variant}
					className="gap-1 text-xs cursor-pointer hover:opacity-80 transition-opacity"
				>
					<Icon className="size-2.5" />
					{label}
				</Badge>
			</button>
		);
	}

	return (
		<Badge variant={variant} className="gap-1 text-xs">
			<Icon className="size-2.5" />
			{label}
		</Badge>
	);
}
