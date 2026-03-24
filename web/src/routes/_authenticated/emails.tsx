import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Loader2, Mail, Sunrise, Zap } from "lucide-react";
import { useState } from "react";
import { EmailTemplateDialog } from "@/components/email-template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/emails")({
	component: EmailsPage,
});

type CapturePage = {
	id: string;
	slug: string;
	title: string;
	incentive_file_name: string | null;
	is_active: boolean;
};

type EmailTemplate = {
	id: string;
	capture_page_id: string;
	subject: string;
	body: string;
	include_incentive_link: boolean;
	delay_mode: "immediate" | "1_hour" | "next_morning";
	is_active: boolean;
	created_at: string;
	updated_at: string;
};

const DELAY_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
	immediate: { label: "Immediately", icon: Zap },
	"1_hour": { label: "After 1 hour", icon: Clock },
	next_morning: { label: "Next morning", icon: Sunrise },
};

function EmailsPage() {
	const { data: pages, isLoading: pagesLoading } = useQuery({
		queryKey: ["capture-pages"],
		queryFn: () => api.get<CapturePage[]>("/capture-pages"),
	});

	const { data: templates, isLoading: templatesLoading } = useQuery({
		queryKey: ["email-templates-all"],
		queryFn: async () => {
			if (!pages?.length) return [];
			const results = await Promise.all(
				pages.map(async (p) => {
					const t = await api.get<EmailTemplate | null>(`/capture-pages/${p.id}/email-template`);
					return { page: p, template: t };
				}),
			);
			return results;
		},
		enabled: !!pages?.length,
	});

	const [editingPageId, setEditingPageId] = useState<string | null>(null);

	const isLoading = pagesLoading || templatesLoading;
	const editingPage = pages?.find((p) => p.id === editingPageId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!pages?.length) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center justify-center py-16">
					<div className="mb-4 rounded-full bg-muted p-4">
						<Mail className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-display text-lg font-semibold">No capture pages yet</h3>
					<p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
						Create a capture page first, then set up follow-up emails for your fans.
					</p>
				</CardContent>
			</Card>
		);
	}

	const withTemplate =
		templates?.filter(
			(t): t is { page: CapturePage; template: EmailTemplate } => t.template !== null,
		) ?? [];
	const withoutTemplate = templates?.filter((t) => !t.template) ?? [];

	return (
		<div className="space-y-6">
			<p className="text-muted-foreground">
				Set up follow-up emails that fans receive after signing up at your shows.
			</p>

			{withTemplate.length > 0 && (
				<div className="space-y-3">
					<h2 className="font-display text-sm font-semibold text-muted-foreground">
						Configured ({withTemplate.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{withTemplate.map(({ page, template }) => {
							const delay = DELAY_LABELS[template.delay_mode];
							const DelayIcon = delay.icon;
							return (
								<Card
									key={page.id}
									className="cursor-pointer transition-colors hover:border-honey-gold/50"
									onClick={() => setEditingPageId(page.id)}
								>
									<CardContent className="space-y-3 p-4">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="font-display truncate text-sm font-semibold">{page.title}</p>
												<p className="truncate text-xs text-muted-foreground">{template.subject}</p>
											</div>
											<Badge
												variant={template.is_active ? "default" : "secondary"}
												className="shrink-0"
											>
												{template.is_active ? "Active" : "Draft"}
											</Badge>
										</div>
										<p className="line-clamp-2 text-xs text-muted-foreground">{template.body}</p>
										<div className="flex items-center gap-3 text-xs text-muted-foreground">
											<span className="flex items-center gap-1">
												<DelayIcon className="size-3" />
												{delay.label}
											</span>
											{template.include_incentive_link && (
												<span className="flex items-center gap-1">
													<Mail className="size-3" />+ download
												</span>
											)}
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</div>
			)}

			{withoutTemplate.length > 0 && (
				<div className="space-y-3">
					<h2 className="font-display text-sm font-semibold text-muted-foreground">
						No email set up ({withoutTemplate.length})
					</h2>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{withoutTemplate.map(({ page }) => (
							<Card
								key={page.id}
								className="cursor-pointer border-dashed transition-colors hover:border-honey-gold/50"
							>
								<CardContent className="flex items-center gap-3 p-4">
									<div className="rounded-full bg-muted p-2">
										<Mail className="size-4 text-muted-foreground" />
									</div>
									<div className="min-w-0 flex-1">
										<p className="font-display truncate text-sm font-semibold">{page.title}</p>
										<p className="text-xs text-muted-foreground">No follow-up email</p>
									</div>
									<Button variant="outline" size="sm" onClick={() => setEditingPageId(page.id)}>
										Set Up
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			)}

			{editingPage && (
				<EmailTemplateDialog
					pageId={editingPage.id}
					pageTitle={editingPage.title}
					hasIncentive={!!editingPage.incentive_file_name}
					open={!!editingPageId}
					onOpenChange={(open) => {
						if (!open) setEditingPageId(null);
					}}
				/>
			)}
		</div>
	);
}
