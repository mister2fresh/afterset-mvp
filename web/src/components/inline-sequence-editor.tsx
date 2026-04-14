import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Lock, Mail, Plus } from "lucide-react";
import { type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { useTier } from "@/hooks/use-tier";
import { api } from "@/lib/api";
import type { PurchasableTier } from "@/lib/pricing";
import type { Tier } from "@/lib/types";
import {
	type EmailTemplate,
	SequenceStepEditor,
	StepDelayIcon,
	type StepEditorHandle,
	stepDelayLabel,
} from "./sequence-step-editor";

const NEXT_TIER: Record<Tier, PurchasableTier> = {
	solo: "tour",
	tour: "superstar",
	superstar: "superstar",
	inactive: "tour",
};

export type SequenceEditorHandle = {
	saveIfDirty: () => void;
};

export function InlineSequenceEditor({
	pageId,
	hasIncentive,
	autoExpandFirst,
	autoScrollDisabled,
	onReady,
	ref,
}: {
	pageId: string;
	hasIncentive: boolean;
	autoExpandFirst?: boolean;
	autoScrollDisabled?: boolean;
	onReady?: () => void;
	ref?: Ref<SequenceEditorHandle>;
}) {
	const queryClient = useQueryClient();
	const queryKey = ["email-sequence", pageId];
	const sectionRef = useRef<HTMLDivElement>(null);
	const expandedStepRef = useRef<StepEditorHandle>(null);
	const newStepRef = useRef<StepEditorHandle>(null);
	useImperativeHandle(ref, () => ({
		saveIfDirty() {
			expandedStepRef.current?.saveIfDirty();
			newStepRef.current?.saveIfDirty();
		},
	}));

	const [sectionOpen, setSectionOpen] = useState(!!autoExpandFirst);
	const [expandedOrder, setExpandedOrder] = useState<number | null>(autoExpandFirst ? 0 : null);
	const [addingNew, setAddingNew] = useState(false);

	const { effectiveTier, limits } = useTier();
	const maxStepsAllowed = limits.sequenceDepth;
	const upgradeTarget = NEXT_TIER[effectiveTier];

	const { data: sequence, isLoading } = useQuery({
		queryKey,
		queryFn: () => api.get<EmailTemplate[]>(`/capture-pages/${pageId}/email-sequence`),
	});

	useEffect(() => {
		if (autoExpandFirst && sequence) {
			onReady?.();
			if (!autoScrollDisabled && sectionRef.current) {
				sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		}
	}, [autoExpandFirst, autoScrollDisabled, sequence, onReady]);

	function invalidateAll() {
		queryClient.invalidateQueries({ queryKey });
		queryClient.invalidateQueries({ queryKey: ["email-sequence-status"] });
		queryClient.invalidateQueries({ queryKey: ["email-sequences-all"] });
	}

	const steps = sequence ?? [];
	const canAddStep = steps.length < maxStepsAllowed;
	const atTierLimit = steps.length >= maxStepsAllowed && effectiveTier !== "superstar";
	const nextOrder = steps.length;
	const activeCount = steps.filter((s) => s.is_active).length;

	return (
		<div ref={sectionRef} className="space-y-3">
			<button
				type="button"
				onClick={() => {
					if (sectionOpen) expandedStepRef.current?.saveIfDirty();
					setSectionOpen(!sectionOpen);
				}}
				className="flex w-full items-center justify-between"
			>
				<Label className="pointer-events-none flex items-center gap-2">
					<Mail className="size-4" />
					Follow-Up Emails
					{steps.length > 0 && (
						<Badge variant={activeCount > 0 ? "default" : "secondary"} className="text-xs">
							{activeCount}/{steps.length} active
						</Badge>
					)}
				</Label>
				{sectionOpen ? (
					<ChevronUp className="size-4 text-muted-foreground" />
				) : (
					<ChevronDown className="size-4 text-muted-foreground" />
				)}
			</button>

			{sectionOpen && (
				<div className="space-y-3">
					{isLoading && (
						<div className="flex items-center justify-center py-6">
							<Loader2 className="size-5 animate-spin text-muted-foreground" />
						</div>
					)}

					{!isLoading &&
						steps.map((step) => {
							const isLocked = step.sequence_order >= maxStepsAllowed;
							const isExpanded = expandedOrder === step.sequence_order;
							return (
								<div
									key={step.id}
									className={`rounded-lg border ${isLocked ? "border-dashed border-border/60 bg-muted/20" : "border-border"}`}
								>
									<button
										type="button"
										onClick={() => {
											expandedStepRef.current?.saveIfDirty();
											setExpandedOrder(isExpanded ? null : step.sequence_order);
										}}
										className="flex w-full items-center gap-3 p-3 text-left"
									>
										<div
											className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.sequence_order === 0 ? "bg-honey-gold/20 text-honey-gold" : "bg-muted"} ${isLocked ? "opacity-50" : ""}`}
										>
											{step.sequence_order + 1}
										</div>
										<div className={`min-w-0 flex-1 ${isLocked ? "opacity-60" : ""}`}>
											<p className="truncate text-sm font-medium">{step.subject || "Untitled"}</p>
											<p className="flex items-center gap-1 text-xs text-muted-foreground">
												<StepDelayIcon step={step} />
												{isLocked
													? `Upgrade to ${NEXT_TIER[effectiveTier]} to reactivate`
													: step.sequence_order === 0
														? "Welcome email"
														: `Follow-up · ${stepDelayLabel(step)}`}
											</p>
										</div>
										{isLocked ? (
											<Badge variant="secondary" className="shrink-0 gap-1 text-xs">
												<Lock className="size-3" />
												Locked
											</Badge>
										) : (
											<Badge
												variant={step.is_active ? "default" : "secondary"}
												className="shrink-0 text-xs"
											>
												{step.is_active ? "Active" : "Draft"}
											</Badge>
										)}
										{isExpanded ? (
											<ChevronUp className="size-4 text-muted-foreground" />
										) : (
											<ChevronDown className="size-4 text-muted-foreground" />
										)}
									</button>
									{isExpanded && (
										<div className="border-t border-border p-3">
											<SequenceStepEditor
												ref={isLocked ? undefined : expandedStepRef}
												pageId={pageId}
												order={step.sequence_order}
												existing={step}
												hasIncentive={hasIncentive}
												onSaved={invalidateAll}
												onDeleted={() => {
													invalidateAll();
													setExpandedOrder(null);
												}}
												readOnly={isLocked}
												lockedUpgradeTarget={isLocked ? upgradeTarget : undefined}
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
								ref={newStepRef}
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

					{!isLoading && canAddStep && !addingNew && (
						<Button
							variant="outline"
							size="sm"
							className="w-full border-dashed"
							onClick={() => {
								expandedStepRef.current?.saveIfDirty();
								setExpandedOrder(null);
								setAddingNew(true);
							}}
						>
							<Plus className="size-4" />
							Add Email
						</Button>
					)}

					{!isLoading && atTierLimit && !addingNew && (
						<UpgradePrompt
							feature={`Add up to ${effectiveTier === "solo" ? "3" : "5"} follow-up emails by upgrading.`}
							requiredTier={upgradeTarget}
							compact
						/>
					)}

					{!isLoading && steps.length === 0 && !addingNew && (
						<p className="py-2 text-center text-sm text-muted-foreground">
							No follow-up emails yet. Add one to engage fans after they sign up.
						</p>
					)}
				</div>
			)}
		</div>
	);
}
