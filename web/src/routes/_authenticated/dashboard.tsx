import { createFileRoute } from "@tanstack/react-router";
import { DashboardAllShows } from "@/components/dashboard-all-shows";
import { DashboardTonight } from "@/components/dashboard-tonight";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
	component: DashboardPage,
});

function DashboardPage(): React.ReactElement {
	return (
		<div className="space-y-6">
			<Tabs defaultValue="tonight">
				<TabsList>
					<TabsTrigger value="tonight">Tonight</TabsTrigger>
					<TabsTrigger value="all-shows">All Shows</TabsTrigger>
				</TabsList>
				<TabsContent value="tonight">
					<DashboardTonight />
				</TabsContent>
				<TabsContent value="all-shows">
					<DashboardAllShows />
				</TabsContent>
			</Tabs>
		</div>
	);
}
