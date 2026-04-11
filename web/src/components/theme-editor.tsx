import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BackgroundStyle = "solid" | "gradient" | "glow";
type ButtonStyle = "rounded" | "pill" | "sharp";
type FontStyle = "modern" | "editorial" | "mono" | "condensed";
type TitleSize = "default" | "large" | "xl";
type LayoutStyle = "centered" | "stacked";

export type ThemeFields = {
	accent_color: string;
	secondary_color: string;
	background_style: BackgroundStyle;
	button_style: ButtonStyle;
	font_style: FontStyle;
	title_size: TitleSize;
	layout_style: LayoutStyle;
	text_color: string;
	bg_color: string;
};

export type PreviewFields = ThemeFields & {
	title: string;
	value_exchange_text: string;
	streaming_links: Record<string, string>;
	social_links: Record<string, string>;
};

type ThemePreset = { name: string } & ThemeFields;

const THEME_FIELD_KEYS = [
	"accent_color",
	"secondary_color",
	"background_style",
	"button_style",
	"font_style",
	"title_size",
	"layout_style",
	"text_color",
	"bg_color",
] as const satisfies readonly (keyof ThemeFields)[];

export const THEME_PRESETS: ThemePreset[] = [
	{
		name: "Gold",
		accent_color: "#E8C547",
		secondary_color: "#D4A017",
		background_style: "solid",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Neon",
		accent_color: "#00E5FF",
		secondary_color: "#E040FB",
		background_style: "glow",
		button_style: "pill",
		font_style: "condensed",
		title_size: "large",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Ember",
		accent_color: "#FF6B35",
		secondary_color: "#F7C948",
		background_style: "gradient",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "stacked",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Violet",
		accent_color: "#A78BFA",
		secondary_color: "#6D28D9",
		background_style: "glow",
		button_style: "pill",
		font_style: "editorial",
		title_size: "large",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
	{
		name: "Minimal",
		accent_color: "#1a1a1a",
		secondary_color: "#9CA3AF",
		background_style: "solid",
		button_style: "sharp",
		font_style: "modern",
		title_size: "default",
		layout_style: "stacked",
		text_color: "#1a1a1a",
		bg_color: "#ffffff",
	},
	{
		name: "Verdant",
		accent_color: "#34D399",
		secondary_color: "#059669",
		background_style: "gradient",
		button_style: "rounded",
		font_style: "modern",
		title_size: "default",
		layout_style: "centered",
		text_color: "#f9fafb",
		bg_color: "#0a0e1a",
	},
];

const BUTTON_RADIUS: Record<ButtonStyle, string> = {
	rounded: "0.375rem",
	pill: "9999px",
	sharp: "0",
};

const FONT_STACK_PREVIEW: Record<FontStyle, string> = {
	modern: "system-ui, sans-serif",
	editorial: "Georgia, Times, serif",
	mono: "ui-monospace, monospace",
	condensed: "system-ui, sans-serif",
};

const TITLE_SIZE_PREVIEW: Record<TitleSize, string> = {
	default: "1rem",
	large: "1.25rem",
	xl: "1.5rem",
};

function isLightColor(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return r * 0.299 + g * 0.587 + b * 0.114 > 150;
}

function previewBackground(
	style: BackgroundStyle,
	accent: string,
	secondary: string,
	bg: string,
): string {
	if (style === "gradient") {
		return `linear-gradient(180deg, ${secondary}42 0%, transparent 60%), ${bg}`;
	}
	if (style === "glow") {
		return `radial-gradient(ellipse at 50% 30%, ${accent}33 0%, transparent 70%), ${bg}`;
	}
	return bg;
}

function applyPreset<T extends ThemeFields>(form: T, preset: ThemePreset): T {
	const updates = Object.fromEntries(THEME_FIELD_KEYS.map((k) => [k, preset[k]]));
	return { ...form, ...updates };
}

export function isPresetActive(form: ThemeFields, preset: ThemePreset): boolean {
	return THEME_FIELD_KEYS.every((k) => form[k] === preset[k]);
}

function CapturePagePreview({ form }: { form: PreviewFields }): React.ReactElement {
	const bg = previewBackground(
		form.background_style,
		form.accent_color,
		form.secondary_color,
		form.bg_color,
	);
	const btnRadius = BUTTON_RADIUS[form.button_style];
	const title = form.title || "Your Page Title";
	const subtitle = form.value_exchange_text || "Get exclusive updates and early access";
	const iconCount =
		Object.values(form.streaming_links).filter((v) => v.trim()).length +
		Object.values(form.social_links).filter((v) => v.trim()).length;
	const fontFamily = FONT_STACK_PREVIEW[form.font_style];
	const titleFontSize = TITLE_SIZE_PREVIEW[form.title_size];
	const isStacked = form.layout_style === "stacked";
	const mutedColor = isLightColor(form.bg_color) ? "#6b7280" : "#9ca3af";
	const inputBg = isLightColor(form.bg_color) ? "#f3f4f6" : "#111827";
	const inputBorder = isLightColor(form.bg_color) ? "#d1d5db" : "#374151";
	const btnTextColor = isLightColor(form.accent_color) ? "#0a0e1a" : "#f9fafb";

	return (
		<div className="overflow-hidden rounded-lg border border-border" style={{ background: bg }}>
			<div className="flex flex-col items-center gap-3 px-6 py-6 text-center">
				<h3
					className="font-bold tracking-tight"
					style={{
						color: form.text_color,
						fontFamily,
						fontSize: titleFontSize,
						textTransform: form.font_style === "condensed" ? "uppercase" : undefined,
						letterSpacing: form.font_style === "condensed" ? "0.15em" : "-0.025em",
					}}
				>
					{title}
				</h3>
				<p className="max-w-[240px] text-xs leading-relaxed" style={{ color: mutedColor }}>
					{subtitle}
				</p>

				<div className={`mt-1 flex w-full max-w-[260px] gap-2 ${isStacked ? "flex-col" : ""}`}>
					<div
						className="flex-1 rounded-md border px-3 py-1.5 text-left text-xs"
						style={{
							borderColor: inputBorder,
							color: mutedColor,
							backgroundColor: inputBg,
						}}
					>
						your@email.com
					</div>
					<div
						className="shrink-0 px-4 py-1.5 text-center text-xs font-semibold"
						style={{
							backgroundColor: form.accent_color,
							color: btnTextColor,
							borderRadius: btnRadius,
						}}
					>
						Join
					</div>
				</div>

				{iconCount > 0 && (
					<div className="mt-1 flex flex-wrap justify-center gap-2">
						{Array.from({ length: Math.min(iconCount, 8) }).map((_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static decorative placeholders
								key={i}
								className="size-6 rounded-full"
								style={{ backgroundColor: form.secondary_color, opacity: 0.6 }}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function ColorPicker({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (v: string) => void;
}): React.ReactElement {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-xs text-muted-foreground">
				{label}
			</Label>
			<div className="flex items-center gap-2">
				<input
					type="color"
					id={id}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
				/>
				<Input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className="font-mono text-xs"
					maxLength={7}
				/>
			</div>
		</div>
	);
}

function OptionRow<T extends string>({
	label,
	options,
	value,
	onChange,
	displayFn,
}: {
	label: string;
	options: readonly T[];
	value: T;
	onChange: (v: T) => void;
	displayFn?: (v: T) => string;
}): React.ReactElement {
	return (
		<div className="space-y-1.5">
			<Label className="text-xs text-muted-foreground">{label}</Label>
			<div className="flex gap-1">
				{options.map((opt) => (
					<button
						key={opt}
						type="button"
						onClick={() => onChange(opt)}
						className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${value === opt ? "border-honey-gold bg-honey-gold/10 text-honey-gold" : "border-border text-muted-foreground hover:border-honey-gold/50"}`}
					>
						{displayFn ? displayFn(opt) : opt}
					</button>
				))}
			</div>
		</div>
	);
}

export function ThemeEditor({
	form,
	onChange,
}: {
	form: PreviewFields;
	onChange: (updates: Partial<ThemeFields>) => void;
}): React.ReactElement {
	const [detailsOpen, setDetailsOpen] = useState(false);

	return (
		<div className="space-y-4">
			<Label>Theme</Label>
			<CapturePagePreview form={form} />
			<div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
				{THEME_PRESETS.map((preset) => {
					const active = isPresetActive(form, preset);
					const bg = previewBackground(
						preset.background_style,
						preset.accent_color,
						preset.secondary_color,
						preset.bg_color,
					);
					const btnRadius = BUTTON_RADIUS[preset.button_style];
					const btnTextColor = isLightColor(preset.accent_color) ? "#0a0e1a" : "#f9fafb";
					return (
						<button
							key={preset.name}
							type="button"
							onClick={() => onChange(applyPreset(form, preset))}
							className={`flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-colors ${active ? "border-honey-gold ring-1 ring-honey-gold/30" : "border-border hover:border-honey-gold/50"}`}
						>
							<div
								className="flex w-full items-center justify-center rounded-md py-3"
								style={{ background: bg }}
							>
								<div
									className="px-3 py-0.5 text-[11px] font-semibold"
									style={{
										backgroundColor: preset.accent_color,
										color: btnTextColor,
										borderRadius: btnRadius,
									}}
								>
									Join
								</div>
							</div>
							<span
								className={`text-xs ${active ? "font-medium text-honey-gold" : "text-muted-foreground"}`}
							>
								{preset.name}
							</span>
						</button>
					);
				})}
			</div>

			<button
				type="button"
				onClick={() => setDetailsOpen(!detailsOpen)}
				className="flex w-full items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				{detailsOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
				Customize colors & style
			</button>

			{detailsOpen && (
				<>
					<div className="grid grid-cols-2 gap-4">
						<ColorPicker
							id="accent_color"
							label="Accent"
							value={form.accent_color}
							onChange={(v) => onChange({ accent_color: v })}
						/>
						<ColorPicker
							id="secondary_color"
							label="Secondary"
							value={form.secondary_color}
							onChange={(v) => onChange({ secondary_color: v })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<ColorPicker
							id="text_color"
							label="Text"
							value={form.text_color}
							onChange={(v) => onChange({ text_color: v })}
						/>
						<ColorPicker
							id="bg_color"
							label="Background"
							value={form.bg_color}
							onChange={(v) => onChange({ bg_color: v })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<OptionRow
							label="Background Effect"
							options={["solid", "gradient", "glow"] as const}
							value={form.background_style}
							onChange={(v) => onChange({ background_style: v })}
						/>
						<OptionRow
							label="Buttons"
							options={["rounded", "pill", "sharp"] as const}
							value={form.button_style}
							onChange={(v) => onChange({ button_style: v })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<OptionRow
							label="Font"
							options={["modern", "editorial", "mono", "condensed"] as const}
							value={form.font_style}
							onChange={(v) => onChange({ font_style: v })}
							displayFn={(v) => (v === "condensed" ? "bold" : v)}
						/>
						<OptionRow
							label="Title Size"
							options={["default", "large", "xl"] as const}
							value={form.title_size}
							onChange={(v) => onChange({ title_size: v })}
							displayFn={(v) => (v === "default" ? "Sm" : v === "large" ? "Md" : "Lg")}
						/>
					</div>

					<OptionRow
						label="Layout"
						options={["centered", "stacked"] as const}
						value={form.layout_style}
						onChange={(v) => onChange({ layout_style: v })}
						displayFn={(v) => (v === "centered" ? "Side by side" : "Stacked")}
					/>
				</>
			)}
		</div>
	);
}
