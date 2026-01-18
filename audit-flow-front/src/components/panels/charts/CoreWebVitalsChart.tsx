import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

interface CoreWebVitalsChartProps {
  avgRequestTime?: number;
  avgDomSize?: number;
  avgHtmlSize?: number;
}

export function CoreWebVitalsChart({ avgRequestTime = 0, avgDomSize = 0, avgHtmlSize = 0 }: CoreWebVitalsChartProps) {
  // Normalize values to percentages (good = higher percentage)
  const lcpScore = Math.max(0, Math.min(100, 100 - (avgRequestTime / 30))); // < 3000ms is good
  const clsScore = Math.max(0, Math.min(100, 100 - (avgDomSize / 30))); // < 3000 elements is good
  const inpScore = Math.max(0, Math.min(100, 100 - (avgHtmlSize / 10000))); // < 1MB is good

  const data = [
    { name: "LCP", value: lcpScore, color: "hsl(280 85% 55%)" },
    { name: "DOM", value: clsScore, color: "hsl(300 80% 50%)" },
    { name: "Size", value: inpScore, color: "hsl(320 75% 55%)" },
  ];
  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-foreground">Core Web Vitals</h3>
        <span className="text-muted-foreground text-xs">ⓘ</span>
      </div>
      
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Core Web Vitals</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent" />
          <span>Long/life recording</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span>Core Web Vitals</span>
        </div>
      </div>

      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barCategoryGap="20%">
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" hide />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100%</span>
      </div>

      <div className="flex justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-muted-foreground">Execut</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Rios</span>
        </div>
      </div>
    </div>
  );
}
