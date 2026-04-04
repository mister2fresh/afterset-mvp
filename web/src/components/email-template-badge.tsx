import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { EmailTemplate } from "./sequence-step-editor";

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
