import { Check, Copy, Smartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

export function NfcSetupDialog({
	slug,
	open,
	onOpenChange,
}: {
	slug: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}): React.ReactElement {
	const nfcUrl = `https://afterset.net/c/${slug}?v=n`;
	const [copied, setCopied] = useState(false);

	async function copyUrl(): Promise<void> {
		await navigator.clipboard.writeText(nfcUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-display flex items-center gap-2">
						<Smartphone className="size-5" />
						Set Up NFC Tap
					</DialogTitle>
					<DialogDescription>
						Let fans tap their phone on a sticker to open your capture page.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					<div className="flex gap-3">
						<StepNumber n={1} />
						<div>
							<p className="text-sm font-medium">Buy NFC stickers</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Get NTAG213 stickers or cards — about $0.30 each on Amazon. Search "NTAG213 NFC
								stickers".
							</p>
						</div>
					</div>

					<div className="flex gap-3">
						<StepNumber n={2} />
						<div className="min-w-0 flex-1 space-y-2">
							<p className="text-sm font-medium">Program with your URL</p>
							<p className="text-xs text-muted-foreground">
								Use a free NFC writer app (NFC Tools on Android/iOS, or Shortcuts on iPhone). Write
								this URL to the tag:
							</p>
							<div className="flex items-center gap-2">
								<code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
									{nfcUrl}
								</code>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="shrink-0"
									onClick={copyUrl}
								>
									{copied ? (
										<Check className="size-4 text-green-500" />
									) : (
										<Copy className="size-4" />
									)}
								</Button>
							</div>
						</div>
					</div>

					<div className="flex gap-3">
						<StepNumber n={3} />
						<div>
							<p className="text-sm font-medium">Stick it & test</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Attach to your merch table, guitar case, or a card. Tap with your phone to verify it
								opens your page.
							</p>
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Done
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StepNumber({ n }: { n: number }): React.ReactElement {
	return (
		<div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-honey-gold/15 text-xs font-bold text-honey-gold">
			{n}
		</div>
	);
}
