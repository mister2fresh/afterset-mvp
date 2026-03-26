import { createFileRoute } from "@tanstack/react-router";
import {
	BarChart3,
	BookOpen,
	Mail,
	MessageSquare,
	QrCode,
	Search,
	Settings,
	UserPlus,
} from "lucide-react";
import { useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { type HelpCategory, helpCategories } from "@/lib/help-topics";

export const Route = createFileRoute("/_authenticated/help")({
	component: HelpPage,
});

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
	"getting-started": UserPlus,
	pages: QrCode,
	emails: Mail,
	sms: MessageSquare,
	analytics: BarChart3,
	account: Settings,
};

function VideoEmbed({ url }: { url: string }) {
	const isLoom = url.includes("loom.com");
	if (isLoom) {
		const embedUrl = url.replace("/share/", "/embed/");
		return (
			<div className="mt-3 aspect-video overflow-hidden rounded-lg">
				<iframe
					src={embedUrl}
					title="Video walkthrough"
					allowFullScreen
					className="h-full w-full border-0"
				/>
			</div>
		);
	}
	return (
		<div className="mt-3 aspect-video overflow-hidden rounded-lg">
			<video src={url} controls className="h-full w-full">
				<track kind="captions" />
			</video>
		</div>
	);
}

function TopicBody({ body }: { body: string }) {
	const lines = body.split("\n");
	const elements: React.ReactNode[] = [];
	let listItems: string[] = [];
	let listKey = 0;

	function flushList() {
		if (listItems.length === 0) return;
		const isOrdered = /^\d+\./.test(listItems[0]);
		const Tag = isOrdered ? "ol" : "ul";
		elements.push(
			<Tag
				key={`list-${listKey++}`}
				className={`space-y-1 pl-5 ${isOrdered ? "list-decimal" : "list-disc"}`}
			>
				{listItems.map((item) => {
					const text = item.replace(/^[-\d]+[.)]\s*/, "");
					return <li key={text}>{formatInline(text)}</li>;
				})}
			</Tag>,
		);
		listItems = [];
	}

	for (const line of lines) {
		const trimmed = line.trim();
		if (/^[-*]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
			listItems.push(trimmed);
		} else {
			flushList();
			if (trimmed === "") {
				continue;
			}
			elements.push(
				<p key={`p-${elements.length}`} className="text-muted-foreground">
					{formatInline(trimmed)}
				</p>,
			);
		}
	}
	flushList();

	return <div className="space-y-3 text-sm leading-relaxed">{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
	const parts = text.split(/(\*\*[^*]+\*\*)/g);
	return parts.map((part) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			return (
				<span key={part} className="font-medium text-foreground">
					{part.slice(2, -2)}
				</span>
			);
		}
		return part;
	});
}

function filterTopics(categories: HelpCategory[], query: string): HelpCategory[] {
	if (!query.trim()) return categories;
	const q = query.toLowerCase();
	return categories
		.map((cat) => ({
			...cat,
			topics: cat.topics.filter(
				(t) => t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q),
			),
		}))
		.filter((cat) => cat.topics.length > 0);
}

function HelpPage() {
	const [search, setSearch] = useState("");
	const filtered = filterTopics(helpCategories, search);

	return (
		<div className="mx-auto max-w-3xl space-y-6">
			<div>
				<h2 className="font-display text-xl font-bold">Help & Guides</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Everything you need to know about capturing fans and growing your list.
				</p>
			</div>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search help topics..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="pl-9"
				/>
			</div>

			{filtered.length === 0 && (
				<div className="py-12 text-center text-muted-foreground">
					<BookOpen className="mx-auto mb-3 size-10 opacity-40" />
					<p>No topics match "{search}"</p>
				</div>
			)}

			{filtered.map((category) => {
				const Icon = categoryIcons[category.id] ?? BookOpen;
				return (
					<Card key={category.id}>
						<CardHeader>
							<div className="flex items-center gap-3">
								<div className="flex size-9 items-center justify-center rounded-lg bg-honey-gold/10">
									<Icon className="size-5 text-honey-gold" />
								</div>
								<div>
									<CardTitle>{category.title}</CardTitle>
									<CardDescription>{category.description}</CardDescription>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<Accordion type="multiple">
								{category.topics.map((topic) => (
									<AccordionItem key={topic.id} value={topic.id}>
										<AccordionTrigger>{topic.title}</AccordionTrigger>
										<AccordionContent>
											<TopicBody body={topic.body} />
											{topic.videoUrl && <VideoEmbed url={topic.videoUrl} />}
										</AccordionContent>
									</AccordionItem>
								))}
							</Accordion>
						</CardContent>
					</Card>
				);
			})}
		</div>
	);
}
