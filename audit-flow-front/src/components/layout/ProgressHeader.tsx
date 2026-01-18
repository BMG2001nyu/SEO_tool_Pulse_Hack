import { motion } from "framer-motion";

interface ProgressHeaderProps {
  step?: number;
  title?: string;
  progress?: number;
  controls?: { label: string; value: string }[];
}

export function ProgressHeader({ 
  title = "AUDIT REPORT: Analysis & Chat",
  progress = 75,
  controls = [
  ]
}: ProgressHeaderProps) {
  return (
    <div className="h-9 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 border-b border-border/30 flex items-center px-4 gap-4">
      {/* Left: Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-primary/80 font-medium tracking-wide">{title}</span>
      </div>

      {/* Center: Progress line */}
      <div className="flex-1 mx-8 hidden lg:block">
        <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
          <motion.div 
            className="h-full progress-gradient rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Right: Control pills */}
      <div className="hidden md:flex items-center gap-2">
        {controls.map((control, i) => (
          <div 
            key={i}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="text-primary">◎</span>
            <span>{control.label}</span>
            {control.value && (
              <span className="text-primary font-medium">{control.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
