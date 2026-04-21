import { Alert, AlertDescription, AlertTitle, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "../components/ui.jsx";

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <Badge variant="outline" className="rounded-full px-3 py-1">{eyebrow}</Badge> : null}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LoadingState({ title = "Loading" }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description="Preparing the latest view." />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
      <Skeleton className="h-[420px] rounded-2xl" />
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", description }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description || "Try refreshing the page or checking the API connection."}</AlertDescription>
    </Alert>
  );
}

export function MetricCard({ title, value, hint, badge, description }) {
  return (
    <Card className="rounded-3xl border-border/60 bg-card/80 backdrop-blur">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <CardDescription>{title}</CardDescription>
          {badge}
        </div>
        <CardTitle className="text-4xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-sm font-medium text-foreground">{hint}</p>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
