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
			<Tabs defaultValue="all-shows">
				<TabsList>
					<TabsTrigger value="all-shows">All Shows</TabsTrigger>
					<TabsTrigger value="tonight">Tonight</TabsTrigger>
				</TabsList>
				<TabsContent value="all-shows">
					<DashboardAllShows />
				</TabsContent>
				<TabsContent value="tonight">
					<DashboardTonight />
				</TabsContent>
			</Tabs>
		</div>
	);
}
