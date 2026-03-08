import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, FileText, Activity } from "lucide-react";

const stats = [
  { title: "Total Users", value: "0", icon: Users, change: "+0%" },
  { title: "Documents", value: "0", icon: FileText, change: "+0%" },
  { title: "Analytics", value: "—", icon: BarChart3, change: "" },
  { title: "Activity", value: "—", icon: Activity, change: "" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome to your SaaS panel. Start adding modules to build your app.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              {stat.change && (
                <p className="text-xs text-muted-foreground">{stat.change} from last month</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex min-h-[300px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-muted-foreground">No modules added yet</p>
            <p className="text-sm text-muted-foreground">This space is ready for your first feature.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
