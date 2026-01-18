import { motion } from "framer-motion";

interface BrokenLinksChartProps {
  totalLinks?: number;
  brokenLinks?: number;
  healthScore?: number;
}

export function BrokenLinksChart({ totalLinks = 0, brokenLinks = 0, healthScore = 0 }: BrokenLinksChartProps) {
  const score = healthScore;
  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-foreground">Broken Links</h3>
        <span className="text-muted-foreground text-xs">ⓘ</span>
      </div>

      <div className="flex items-center justify-center py-2">
        <div className="relative">
          <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="10"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="35"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{score}%</span>
            <span className="text-[10px] text-muted-foreground">Health</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-6 mt-2 text-xs">
        <div className="text-center">
          <span className="text-foreground font-medium">{totalLinks}</span>
          <br />
          <span className="text-muted-foreground">Total Links</span>
        </div>
        <div className="text-center">
          <span className="text-foreground font-medium">{brokenLinks}</span>
          <br />
          <span className="text-muted-foreground">Broken</span>
        </div>
      </div>

      <div className="flex justify-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-muted-foreground">Healthy</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-destructive" />
          <span className="text-muted-foreground">Broken</span>
        </div>
      </div>
    </div>
  );
}
